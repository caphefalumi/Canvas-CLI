/**
 * Submit command for interactive assignment submission
 */

import fs from 'fs';
import path from 'path';
import { makeCanvasRequest } from '../lib/api-client.js';
import { createReadlineInterface, askQuestion, askConfirmation, selectFilesImproved, selectFilesKeyboard, pad } from '../lib/interactive.js';
import { uploadSingleFileToCanvas, submitAssignmentWithFiles } from '../lib/file-upload.js';
import chalk from 'chalk';

export async function submitAssignment(options) {
  const rl = createReadlineInterface();
  
  try {
    let courseId = options.course;
    let assignmentId = options.assignment;
    let selectedCourse = null;
    let selectedAssignment = null;
    
    
    // Step 1 & 2: Select Course and Assignment (if not provided)
    while (!courseId || !assignmentId) {
      if (!courseId) {
        let courses = null;
        while (true) {
          console.log(chalk.cyan.bold(`\n${'-'.repeat(60)}`));
          console.log(chalk.cyan.bold('Loading your courses, please wait...'));
          try {
            courses = await makeCanvasRequest('get', 'courses', [
              'enrollment_state=active',
              'include[]=favorites'
            ]);
          } catch (error) {
            console.error(chalk.red('Error: Failed to load courses: ' + error.message));
            const retryCourses = await askConfirmation(rl, chalk.yellow('Try loading courses again?'), true);
            if (retryCourses) {
              continue;
            }
            console.log(chalk.yellow('Submission cancelled.'));
            return;
          }

          if (!courses || courses.length === 0) {
            console.log(chalk.red('Error: No courses found.'));
            const retryCourses = await askConfirmation(rl, chalk.yellow('Refresh course list?'), true);
            if (retryCourses) {
              continue;
            }
            console.log(chalk.yellow('Submission cancelled.'));
            return;
          }
          break;
        }

        let selectableCourses = courses;
        if (!options.all) {
          selectableCourses = courses.filter(course => course.is_favorite);
          if (selectableCourses.length === 0) {
            console.log(chalk.yellow('No starred courses found. Showing all enrolled courses...'));
            selectableCourses = courses;
          }
        }

        console.log(chalk.cyan('-'.repeat(60)));
        console.log(chalk.cyan.bold('Select a course:'));
        selectableCourses.forEach((course, index) => {
          console.log(pad(chalk.white((index + 1) + '. '), 5) + chalk.white(course.name));
        });

        while (!courseId) {
          const courseChoice = await askQuestion(rl, chalk.bold.cyan(`
Enter course number (or ".."/"back" to cancel): `));
          if (courseChoice === '..' || courseChoice.toLowerCase() === 'back') {
            const confirmCancel = await askConfirmation(rl, chalk.yellow('Cancel submission?'), false);
            if (confirmCancel) {
              console.log(chalk.yellow('Submission cancelled.'));
              return;
            }
            continue;
          }
          if (!courseChoice.trim()) {
            console.log(chalk.yellow('Please enter a course number.'));
            continue;
          }
          const parsedIndex = Number.parseInt(courseChoice, 10);
          if (Number.isNaN(parsedIndex)) {
            console.log(chalk.red('Error: Please enter a valid course number.'));
            continue;
          }
          const courseIndex = parsedIndex - 1;
          if (courseIndex < 0 || courseIndex >= selectableCourses.length) {
            console.log(chalk.red('Error: Invalid course selection.'));
            continue;
          }
          selectedCourse = selectableCourses[courseIndex];
          courseId = selectedCourse.id;
          console.log(chalk.green(`Success: Selected ${selectedCourse.name}
`));
        }
      }

      if (!assignmentId) {
        let assignments = null;
        while (true) {
          console.log(chalk.cyan.bold('-'.repeat(60)));
          console.log(chalk.cyan.bold('Loading assignments, please wait...'));
          try {
            assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
              'include[]=submission',
              'order_by=due_at',
              'per_page=100'
            ]);
          } catch (error) {
            console.error(chalk.red('Error: Failed to load assignments: ' + error.message));
            const retryAssignments = await askConfirmation(rl, chalk.yellow('Try loading assignments again?'), true);
            if (retryAssignments) {
              continue;
            }
            const chooseDifferentCourse = await askConfirmation(rl, chalk.yellow('Choose a different course?'), true);
            if (chooseDifferentCourse) {
              courseId = null;
              selectedCourse = null;
              break;
            }
            console.log(chalk.yellow('Submission cancelled.'));
            return;
          }

          if (!assignments || assignments.length === 0) {
            console.log(chalk.red('Error: No assignments found for this course.'));
            const chooseDifferentCourse = await askConfirmation(rl, chalk.yellow('Select a different course?'), true);
            if (chooseDifferentCourse) {
              courseId = null;
              selectedCourse = null;
              break;
            }
            const retryAssignments = await askConfirmation(rl, chalk.yellow('Refresh assignments for this course?'), true);
            if (retryAssignments) {
              continue;
            }
            console.log(chalk.yellow('Submission cancelled.'));
            return;
          }
          break;
        }

        if (!courseId) {
          assignmentId = null;
          selectedAssignment = null;
          continue;
        }

        console.log(chalk.cyan('-'.repeat(60)));
        console.log(chalk.cyan.bold(`Found ${assignments.length} assignment(s):`));
        const submittedCount = assignments.filter(a => a.submission && a.submission.submitted_at).length;
        const pendingCount = assignments.length - submittedCount;
        const uploadableCount = assignments.filter(a =>
          a.submission_types &&
          a.submission_types.includes('online_upload') &&
          a.workflow_state === 'published'
        ).length;
        console.log(chalk.yellow(`Summary: ${submittedCount} submitted, ${pendingCount} pending, ${uploadableCount} accept file uploads`));
        console.log(chalk.cyan('-'.repeat(60)));

        assignments.forEach((assignment, index) => {
          const dueDate = assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date';
          const submitted = assignment.submission && assignment.submission.submitted_at ? chalk.green('Submitted') : chalk.yellow('Not submitted');
          const canSubmitFiles = assignment.submission_types && assignment.submission_types.includes('online_upload') && assignment.workflow_state === 'published';
          let gradeDisplay = '';
          const submission = assignment.submission;
          if (submission && submission.score !== null && submission.score !== undefined) {
            const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
            const total = assignment.points_possible || 0;
            gradeDisplay = ` | Grade: ${score}/${total}`;
          } else if (submission && submission.excused) {
            gradeDisplay = ' | Grade: Excused';
          } else if (submission && submission.missing) {
            gradeDisplay = ' | Grade: Missing';
          } else if (assignment.points_possible) {
            gradeDisplay = ` | Grade: –/${assignment.points_possible}`;
          }
          let line = pad(chalk.white((index + 1) + '. '), 5) + chalk.white(assignment.name) + chalk.gray(` (${dueDate})`) + ' ' + submitted + gradeDisplay;
          if (!canSubmitFiles) {
            line += chalk.red(' [No file uploads]');
          }
          console.log(line);
        });

        let awaitingAssignment = true;
        while (awaitingAssignment) {
          const assignmentChoice = await askQuestion(rl, chalk.bold.cyan(`
Enter assignment number (or ".."/"back" to re-select course): `));
          if (assignmentChoice === '..' || assignmentChoice.toLowerCase() === 'back') {
            const chooseCourseAgain = await askConfirmation(rl, chalk.yellow('Go back to course selection?'), true);
            if (chooseCourseAgain) {
              courseId = null;
              selectedCourse = null;
              assignmentId = null;
              selectedAssignment = null;
              awaitingAssignment = false;
              break;
            }
            continue;
          }
          if (!assignmentChoice.trim()) {
            console.log(chalk.yellow('Please enter an assignment number.'));
            continue;
          }
          const parsedIndex = Number.parseInt(assignmentChoice, 10);
          if (Number.isNaN(parsedIndex)) {
            console.log(chalk.red('Error: Please enter a valid assignment number.'));
            continue;
          }
          const assignmentIndex = parsedIndex - 1;
          if (assignmentIndex < 0 || assignmentIndex >= assignments.length) {
            console.log(chalk.red('Error: Invalid assignment selection.'));
            continue;
          }
          const candidate = assignments[assignmentIndex];
          const canSubmitFiles = candidate.submission_types && candidate.submission_types.includes('online_upload') && candidate.workflow_state === 'published';
          if (!canSubmitFiles) {
            console.log(chalk.red('Error: This assignment does not accept file uploads or is not published.'));
            continue;
          }
          selectedAssignment = candidate;
          assignmentId = candidate.id;
          console.log(chalk.green(`Success: Selected ${selectedAssignment.name}
`));
          if (selectedAssignment.submission && selectedAssignment.submission.submitted_at) {
            const resubmit = await askConfirmation(rl, chalk.yellow('This assignment has already been submitted. Do you want to resubmit?'), true);
            if (!resubmit) {
              console.log(chalk.yellow('Select a different assignment.'));
              assignmentId = null;
              selectedAssignment = null;
              continue;
            }
          }
          awaitingAssignment = false;
        }

        if (!courseId) {
          continue;
        }
      }

      if (courseId && assignmentId) {
        break;
      }
    }

    // Step 3: Choose file selection method and select files
    let filePaths = [];
    while (filePaths.length === 0) {
      console.log(chalk.cyan.bold('-'.repeat(60)));
      console.log(chalk.cyan.bold('File Selection Method'));
      console.log(chalk.cyan('-'.repeat(60)));
      const courseLabel = selectedCourse?.name || `Course ${courseId}`;
      const assignmentLabel = selectedAssignment?.name || `Assignment ${assignmentId}`;
      console.log(chalk.white('Course: ') + chalk.bold(courseLabel));
      console.log(chalk.white('Assignment: ') + chalk.bold(assignmentLabel));
      console.log();

      console.log(chalk.yellow('📁 Choose file selection method:'));
      console.log(chalk.white('1. ') + chalk.cyan('Keyboard Navigator') + chalk.gray(' (NEW! - Use arrow keys and space bar to navigate and select)'));
      console.log(chalk.white('2. ') + chalk.cyan('Text-based Selector') + chalk.gray(' (Traditional - Type filenames and wildcards)'));
      console.log(chalk.white('3. ') + chalk.cyan('Basic Directory Listing') + chalk.gray(' (Simple - Select from numbered list)'));

      let selectorChoice = '';
      while (true) {
        selectorChoice = await askQuestion(rl, chalk.bold.cyan(`
Choose method (1-3): `));
        if (!selectorChoice) {
          console.log(chalk.yellow('Please choose option 1, 2, or 3.'));
          continue;
        }
        if (['1', '2', '3'].includes(selectorChoice)) {
          break;
        }
        console.log(chalk.red('Invalid option. Please enter 1, 2, or 3.'));
      }

      if (selectorChoice === '1') {
        filePaths = await selectFilesKeyboard(rl);
      } else if (selectorChoice === '2') {
        filePaths = await selectFilesImproved(rl);
      } else {
        filePaths = await selectFiles(rl);
      }

      if (!filePaths || filePaths.length === 0) {
        console.log(chalk.yellow('No files selected.'));
        const retrySelection = await askConfirmation(rl, chalk.yellow('Do you want to try selecting files again?'), true);
        if (!retrySelection) {
          console.log(chalk.yellow('Submission cancelled.'));
          return;
        }
        continue;
      }

      const validFiles = [];
      for (const file of filePaths) {
        if (fs.existsSync(file)) {
          validFiles.push(file);
        } else {
          console.log(chalk.red('Error: File not found: ' + file));
        }
      }

      if (validFiles.length === 0) {
        console.log(chalk.red('Error: No valid files selected.'));
        const retrySelection = await askConfirmation(rl, chalk.yellow('Try selecting files again?'), true);
        if (!retrySelection) {
          console.log(chalk.yellow('Submission cancelled.'));
          return;
        }
        filePaths = [];
        continue;
      }

      filePaths = validFiles;
    }

    // Step 4: Confirm and Submit
    console.log(chalk.cyan.bold('-'.repeat(60)));
    console.log(chalk.cyan.bold('Submission Summary:'));
    console.log(chalk.cyan('-'.repeat(60)));
    const courseSummary = selectedCourse?.name || `Course ${courseId}`;
    const assignmentSummary = selectedAssignment?.name || `Assignment ${assignmentId}`;
    console.log(chalk.white('Course: ') + chalk.bold(courseSummary));
    console.log(chalk.white('Assignment: ') + chalk.bold(assignmentSummary));
    console.log(chalk.white(`Files (${filePaths.length}):`));
    filePaths.forEach((file, index) => {
      try {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(pad(chalk.white((index + 1) + '.'), 5) + pad(path.basename(file), 35) + chalk.gray(size));
      } catch (error) {
        console.log(pad(chalk.white((index + 1) + '.'), 5) + pad(path.basename(file), 35) + chalk.red(' [unavailable]'));
      }
    });
    const confirm = await askConfirmation(rl, chalk.bold.cyan(`
Proceed with submission?`), true);
    if (!confirm) {
      console.log(chalk.yellow('Submission cancelled.'));
      return;
    }

    console.log(chalk.cyan.bold(`
Uploading files, please wait...`));
    // Upload all files
    const uploadedFileIds = [];
    for (let i = 0; i < filePaths.length; i++) {
      const currentFile = filePaths[i];
      process.stdout.write(chalk.yellow(`Uploading ${i + 1}/${filePaths.length}: ${path.basename(currentFile)} ... `));
      try {
        const fileId = await uploadSingleFileToCanvas(courseId, assignmentId, currentFile);
        uploadedFileIds.push(fileId);
        console.log(chalk.green('Success: Uploaded.'));
      } catch (error) {
        console.error(chalk.red(`Error: Failed to upload ${currentFile}: ${error.message}`));
        const continueUpload = await askConfirmation(rl, chalk.yellow('Continue with remaining files?'), true);
        if (!continueUpload) {
          break;
        }
      }
    }
    // Submit assignment with uploaded files
    if (uploadedFileIds.length > 0) {
      try {
        console.log(chalk.cyan.bold('Submitting assignment, please wait...'));
        await submitAssignmentWithFiles(courseId, assignmentId, uploadedFileIds);
        console.log(chalk.green('Success: Assignment submitted successfully!'));
      } catch (error) {
        console.error(chalk.red('Error: Failed to submit assignment: ' + error.message));
      }
    } else {
      console.log(chalk.red('Error: No files were uploaded. Submission not completed.'));
    }

  } catch (error) {
    console.error(chalk.red('Error: Submission failed: ' + error.message));
  } finally {
    rl.close();
  }
}

async function selectFiles(rl) {
  console.log('📁 File selection options:');
  console.log('1. Enter file path(s) manually');
  console.log('2. Select from current directory');

  while (true) {
    const fileChoice = await askQuestion(rl, '\nChoose option (1-2): ');

    if (!fileChoice) {
      console.log('Please choose option 1 or 2.');
      continue;
    }

    if (fileChoice === '1') {
      return await selectFilesManually(rl);
    }
    if (fileChoice === '2') {
      return await selectFilesFromDirectory(rl);
    }

    console.log('Invalid option. Please enter 1 or 2.');
  }
}

async function selectFilesManually(rl) {
  let mode = '';
  while (true) {
    mode = await askQuestion(rl, 'Submit single file or multiple files? (s/m): ');
    if (!mode) {
      mode = 's';
      break;
    }
    const normalized = mode.toLowerCase();
    if (normalized === 's' || normalized === 'single') {
      mode = 's';
      break;
    }
    if (normalized === 'm' || normalized === 'multiple') {
      mode = 'm';
      break;
    }
    console.log('Please enter "s" for single or "m" for multiple.');
  }

  const filePaths = [];
  if (mode === 'm') {
    console.log('Enter file paths (one per line). Press Enter on empty line to finish:');
    while (true) {
      const fileInput = await askQuestion(rl, 'File path: ');
      if (!fileInput) {
        break;
      }
      filePaths.push(fileInput);
    }
  } else {
    while (filePaths.length === 0) {
      const singleFile = await askQuestion(rl, 'Enter file path: ');
      if (!singleFile) {
        console.log('File path cannot be empty.');
        continue;
      }
      filePaths.push(singleFile);
    }
  }

  return filePaths;
}

async function selectFilesFromDirectory(rl) {
  while (true) {
    let files;
    try {
      files = fs.readdirSync('.').filter(file => {
        try {
          return (
            fs.statSync(file).isFile() &&
            !file.startsWith('.') &&
            file !== 'package.json' &&
            file !== 'README.md'
          );
        } catch {
          return false;
        }
      });
    } catch (error) {
      console.log('Error reading directory: ' + error.message);
      const manualFile = await askQuestion(rl, 'Enter file path manually: ');
      return manualFile ? [manualFile] : [];
    }

    if (!files || files.length === 0) {
      console.log('No suitable files found in current directory.');
      const manualFile = await askQuestion(rl, 'Enter file path manually: ');
      return manualFile ? [manualFile] : [];
    }

    console.log('\nFiles in current directory:');
    files.forEach((file, index) => {
      try {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(`${index + 1}. ${file} (${size})`);
      } catch (error) {
        console.log(`${index + 1}. ${file} (unavailable)`);
      }
    });

    while (true) {
      const multipleFiles = await askQuestion(rl, '\nSelect multiple files? (y/N): ');
      if (!multipleFiles) {
        const selection = await selectSingleFileFromList(rl, files);
        if (selection.length > 0) {
          return selection;
        }
      } else {
        const normalized = multipleFiles.toLowerCase();
        if (normalized === 'y' || normalized === 'yes') {
          const selection = await selectMultipleFilesFromList(rl, files);
          if (selection.length > 0) {
            return selection;
          }
        } else if (normalized === 'n' || normalized === 'no') {
          const selection = await selectSingleFileFromList(rl, files);
          if (selection.length > 0) {
            return selection;
          }
        } else {
          console.log('Please answer with y or n.');
          continue;
        }
      }

      console.log('No files selected. Returning to file list.');
      break;
    }
  }
}

async function selectMultipleFilesFromList(rl, files) {
  console.log('Enter file numbers separated by commas (e.g., 1,3,5) or ranges (e.g., 1-3). Type ".." or "back" to cancel.');
  while (true) {
    const fileIndices = await askQuestion(rl, 'File numbers: ');
    if (!fileIndices) {
      return [];
    }
    if (fileIndices === '..' || fileIndices.toLowerCase() === 'back') {
      return [];
    }

    const selectedIndices = [];
    const parts = fileIndices.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-').map(n => n.trim());
        const start = Number.parseInt(startStr, 10);
        const end = Number.parseInt(endStr, 10);
        if (Number.isNaN(start) || Number.isNaN(end)) {
          continue;
        }
        const rangeStart = Math.min(start, end);
        const rangeEnd = Math.max(start, end);
        for (let i = rangeStart; i <= rangeEnd; i++) {
          selectedIndices.push(i - 1);
        }
      } else {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isNaN(parsed)) {
          selectedIndices.push(parsed - 1);
        }
      }
    }

    const uniqueIndices = [...new Set(selectedIndices)].filter(
      index => index >= 0 && index < files.length
    );

    if (uniqueIndices.length === 0) {
      console.log('No valid file selections. Please try again.');
      continue;
    }

    return uniqueIndices.map(index => files[index]);
  }
}

async function selectSingleFileFromList(rl, files) {
  while (true) {
    const fileIndex = await askQuestion(rl, '\nEnter file number (or ".." to cancel): ');
    if (!fileIndex) {
      console.log('Please enter a file number or ".." to cancel.');
      continue;
    }
    if (fileIndex === '..' || fileIndex.toLowerCase() === 'back') {
      return [];
    }

    const selectedFileIndex = Number.parseInt(fileIndex, 10) - 1;
    if (Number.isNaN(selectedFileIndex)) {
      console.log('Please enter a valid number.');
      continue;
    }

    if (selectedFileIndex >= 0 && selectedFileIndex < files.length) {
      return [files[selectedFileIndex]];
    }

    console.log('Invalid file selection. Please try again.');
  }
}
