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
    
    // Step 1: Select Course (if not provided)
    while (!courseId) {
      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Loading your courses, please wait...'));
      const courses = await makeCanvasRequest('get', 'courses', [
        'enrollment_state=active',
        'include[]=favorites'
      ]);
      if (!courses || courses.length === 0) {
        console.log(chalk.red('Error: No courses found.'));
        rl.close();
        return;
      }
      let selectableCourses = courses;
      if (!options.all) {
        selectableCourses = courses.filter(course => course.is_favorite);
        if (selectableCourses.length === 0) {
          console.log(chalk.red('Error: No starred courses found. Showing all enrolled courses...'));
          selectableCourses = courses;
        }
      }
      console.log(chalk.cyan('-'.repeat(60)));
      console.log(chalk.cyan.bold('Select a course:'));
      selectableCourses.forEach((course, index) => {
        console.log(pad(chalk.white((index + 1) + '. '), 5) + chalk.white(course.name));
      });
      const courseChoice = await askQuestion(rl, chalk.bold.cyan('\nEnter course number (or ".."/"back" to cancel): '));
      if (courseChoice === '..' || courseChoice.toLowerCase() === 'back') {
        rl.close();
        return;
      }
      if (!courseChoice.trim()) {
        console.log(chalk.red('Error: No course selected. Exiting...'));
        rl.close();
        return;
      }
      const courseIndex = parseInt(courseChoice) - 1;
      if (courseIndex < 0 || courseIndex >= selectableCourses.length) {
        console.log(chalk.red('Error: Invalid course selection.'));
        continue;
      }
      selectedCourse = selectableCourses[courseIndex];
      courseId = selectedCourse.id;
      console.log(chalk.green(`Success: Selected ${selectedCourse.name}\n`));
    }
    
    // Step 2: Select Assignment (if not provided)
    while (!assignmentId) {
      console.log(chalk.cyan.bold('-'.repeat(60)));
      console.log(chalk.cyan.bold('Loading assignments, please wait...'));
      const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
        'include[]=submission',
        'order_by=due_at',
        'per_page=100'
      ]);
      if (!assignments || assignments.length === 0) {
        console.log(chalk.red('Error: No assignments found for this course.'));
        rl.close();
        return;
      }
      console.log(chalk.cyan('-'.repeat(60)));
      console.log(chalk.cyan.bold(`Found ${assignments.length} assignment(s):`));
      // Show summary of assignment statuses
      const submittedCount = assignments.filter(a => a.submission && a.submission.submitted_at).length;
      const pendingCount = assignments.length - submittedCount;
      const uploadableCount = assignments.filter(a => 
        a.submission_types && 
        a.submission_types.includes('online_upload') && 
        a.workflow_state === 'published'
      ).length;
      console.log(chalk.yellow(`Summary: ${submittedCount} submitted, ${pendingCount} pending, ${uploadableCount} accept file uploads`));
      console.log(chalk.cyan('-'.repeat(60)));
      // Numbered menu
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
      const assignmentChoice = await askQuestion(rl, chalk.bold.cyan('\nEnter assignment number (or ".."/"back" to re-select course): '));
      if (assignmentChoice === '..' || assignmentChoice.toLowerCase() === 'back') {
        courseId = null;
        selectedCourse = null;
        break;
      }
      if (!assignmentChoice.trim()) {
        console.log(chalk.red('Error: No assignment selected. Exiting...'));
        rl.close();
        return;
      }
      const assignmentIndex = parseInt(assignmentChoice) - 1;
      if (assignmentIndex < 0 || assignmentIndex >= assignments.length) {
        console.log(chalk.red('Error: Invalid assignment selection.'));
        continue;
      }
      selectedAssignment = assignments[assignmentIndex];
      if (!selectedAssignment.submission_types || !selectedAssignment.submission_types.includes('online_upload') || selectedAssignment.workflow_state !== 'published') {
        console.log(chalk.red('Error: This assignment does not accept file uploads or is not published.'));
        rl.close();
        return;
      }
      assignmentId = selectedAssignment.id;
      console.log(chalk.green(`Success: Selected ${selectedAssignment.name}\n`));      if (selectedAssignment.submission && selectedAssignment.submission.submitted_at) {
        const resubmit = await askConfirmation(rl, chalk.yellow('This assignment has already been submitted. Do you want to resubmit?'), true);
        if (!resubmit) {
          console.log(chalk.yellow('Submission cancelled.'));
          rl.close();
          return;
        }
      }
    }
    
    // Step 3: Choose file selection method and select files
    let filePaths = [];
    console.log(chalk.cyan.bold('-'.repeat(60)));
    console.log(chalk.cyan.bold('File Selection Method'));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.white('Course: ') + chalk.bold(selectedCourse.name));
    console.log(chalk.white('Assignment: ') + chalk.bold(selectedAssignment.name) + '\n');
    
    console.log(chalk.yellow('📁 Choose file selection method:'));
    console.log(chalk.white('1. ') + chalk.cyan('Keyboard Navigator') + chalk.gray(' (NEW! - Use arrow keys and space bar to navigate and select)'));
    console.log(chalk.white('2. ') + chalk.cyan('Text-based Selector') + chalk.gray(' (Traditional - Type filenames and wildcards)'));
    console.log(chalk.white('3. ') + chalk.cyan('Basic Directory Listing') + chalk.gray(' (Simple - Select from numbered list)'));
    
    const selectorChoice = await askQuestion(rl, chalk.bold.cyan('\nChoose method (1-3): '));
    
    console.log(chalk.cyan.bold('-'.repeat(60)));
    console.log(chalk.cyan.bold('File Selection'));
    console.log(chalk.cyan('-'.repeat(60)));
    
    if (selectorChoice === '1') {
      filePaths = await selectFilesKeyboard(rl);
    } else if (selectorChoice === '2') {
      filePaths = await selectFilesImproved(rl);
    } else {
      filePaths = await selectFiles(rl);
    }
    // Validate all selected files exist
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
      rl.close();
      return;
    }
    filePaths = validFiles;
    // Step 4: Confirm and Submit
    console.log(chalk.cyan.bold('-'.repeat(60)));
    console.log(chalk.cyan.bold('Submission Summary:'));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.white('Course: ') + chalk.bold(selectedCourse?.name || 'Unknown Course'));
    console.log(chalk.white('Assignment: ') + chalk.bold(selectedAssignment?.name || 'Unknown Assignment'));
    console.log(chalk.white(`Files (${filePaths.length}):`));
    filePaths.forEach((file, index) => {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(pad(chalk.white((index + 1) + '.'), 5) + pad(path.basename(file), 35) + chalk.gray(size));
    });
    const confirm = await askConfirmation(rl, chalk.bold.cyan('\nProceed with submission?'), true);
    if (!confirm) {
      console.log(chalk.yellow('Submission cancelled.'));
      rl.close();
      return;
    }
    console.log(chalk.cyan.bold('\nUploading files, please wait...'));
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
  
  const fileChoice = await askQuestion(rl, '\nChoose option (1-2): ');
  
  if (fileChoice === '1') {
    return await selectFilesManually(rl);
  } else if (fileChoice === '2') {
    return await selectFilesFromDirectory(rl);
  } else {
    console.log('Invalid option.');
    return [];
  }
}

async function selectFilesManually(rl) {
  const singleOrMultiple = await askQuestion(rl, 'Submit single file or multiple files? (s/m): ');
  const filePaths = [];
  
  if (singleOrMultiple.toLowerCase() === 'm' || singleOrMultiple.toLowerCase() === 'multiple') {
    console.log('Enter file paths (one per line). Press Enter on empty line to finish:');
    let fileInput = '';
    while (true) {
      fileInput = await askQuestion(rl, 'File path: ');
      if (fileInput === '') break;
      filePaths.push(fileInput);
    }
  } else {
    const singleFile = await askQuestion(rl, 'Enter file path: ');
    filePaths.push(singleFile);
  }
  
  return filePaths;
}

async function selectFilesFromDirectory(rl) {
  try {
    const files = fs.readdirSync('.').filter(file => 
      fs.statSync(file).isFile() && 
      !file.startsWith('.') &&
      file !== 'package.json' &&
      file !== 'README.md'
    );
    
    if (files.length === 0) {
      console.log('No suitable files found in current directory.');
      const manualFile = await askQuestion(rl, 'Enter file path manually: ');
      return [manualFile];
    }
    
    console.log('\nFiles in current directory:');
    files.forEach((file, index) => {
      const stats = fs.statSync(file);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(`${index + 1}. ${file} (${size})`);
    });
    
    const multipleFiles = await askQuestion(rl, '\nSelect multiple files? (y/N): ');
    
    if (multipleFiles.toLowerCase() === 'y' || multipleFiles.toLowerCase() === 'yes') {
      return await selectMultipleFilesFromList(rl, files);
    } else {
      return await selectSingleFileFromList(rl, files);
    }
  } catch (error) {
    console.log('Error reading directory.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
}

async function selectMultipleFilesFromList(rl, files) {
  console.log('Enter file numbers separated by commas (e.g., 1,3,5) or ranges (e.g., 1-3):');
  const fileIndices = await askQuestion(rl, 'File numbers: ');
  
  const selectedIndices = [];
  const parts = fileIndices.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      // Handle range (e.g., 1-3)
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      for (let i = start; i <= end; i++) {
        selectedIndices.push(i - 1); // Convert to 0-based index
      }
    } else {
      // Handle single number
      selectedIndices.push(parseInt(trimmed) - 1); // Convert to 0-based index
    }
  }
  
  // Remove duplicates and filter valid indices
  const uniqueIndices = [...new Set(selectedIndices)].filter(
    index => index >= 0 && index < files.length
  );
  
  if (uniqueIndices.length === 0) {
    console.log('No valid file selections.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
  
  return uniqueIndices.map(index => files[index]);
}

async function selectSingleFileFromList(rl, files) {
  const fileIndex = await askQuestion(rl, '\nEnter file number: ');
  const selectedFileIndex = parseInt(fileIndex) - 1;
  
  if (selectedFileIndex >= 0 && selectedFileIndex < files.length) {
    return [files[selectedFileIndex]];
  } else {
    console.log('Invalid file selection.');
    const manualFile = await askQuestion(rl, 'Enter file path manually: ');
    return [manualFile];
  }
}
