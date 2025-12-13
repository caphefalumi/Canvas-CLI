/**
 * Submit assignment command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import { uploadSingleFileToCanvas, submitAssignmentWithFiles } from '../lib/file-upload.js';
import { 
  createReadlineInterface, 
  selectFilesKeyboard,
  askQuestion,
  askConfirmation 
} from '../lib/interactive.js';
import chalk from 'chalk';
import path from 'path';
import type { CanvasCourse, CanvasAssignment } from '../types/index.js';
import { randomInt } from 'crypto';

interface SubmitOptions {
  course?: string;
  file?: string;
  all?: boolean;
  dryRun?: boolean;
}

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/**
 * Clear the last N lines from the terminal
 */
function clearLines(count: number = 1): void {
  if (!process.stdout.isTTY) return;
  for (let i = 0; i < count; i++) {
    process.stdout.moveCursor(0, -1); // Move cursor up one line
    process.stdout.clearLine(1);      // Clear from cursor to end of line
  }
}

export async function submitAssignment(options: SubmitOptions): Promise<void> {
  if (options.dryRun) {
    console.log(chalk.bgRedBright('Dry run mode - no actual submission will be made'))
  }
  let rl = createReadlineInterface();
  let rlForConfirm = rl;

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nSubmission cancelled by user.'));
    if (rl) rl.close();
    if (rlForConfirm && rlForConfirm !== rl) rlForConfirm.close();
    process.exit(0);
  });

  try {
    console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
    console.log(chalk.cyan.bold('Canvas Assignment Submission'));
    console.log(chalk.cyan.bold('='.repeat(60)));

    // Step 1: Select Course
    let courseId: number;
    if (options.course) {
      courseId = parseInt(options.course);
      console.log(chalk.green(`✓ Using specified course ID: ${courseId}`));
    } else {
      console.log(chalk.cyan('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Step 1: Select Course'));
      console.log(chalk.cyan('-'.repeat(60)));
      
      const queryParams = options.all 
        ? ['enrollment_state=active', 'per_page=100', 'include[]=term', 'include[]=favorites']
        : ['enrollment_state=active', 'per_page=100', 'include[]=term', 'include[]=favorites'];
      
      const courses = await makeCanvasRequest<CanvasCourse[]>('get', 'courses', queryParams);
      
      if (!courses || courses.length === 0) {
        console.log(chalk.red('Error: No courses found.'));
        rl.close();
        return;
      }

      // Filter starred courses if not showing all
      let displayCourses = courses;
      if (!options.all) {
        displayCourses = courses.filter(c => c.is_favorite);
        if (displayCourses.length === 0) {
          console.log(chalk.yellow('No starred courses found. Showing all courses instead.'));
          displayCourses = courses;
        }
      }

      // Sort by name
      displayCourses.sort((a, b) => a.name.localeCompare(b.name));

      console.log(chalk.cyan.bold('Select a course:'));
      displayCourses.forEach((course, index) => {
        console.log(chalk.white(`${index + 1}.`) + ' ' + course.name);
      });

      const courseChoice = await askQuestion(rl, chalk.white('\nEnter course number (or ".."/"back" to cancel): '));
      
      if (!courseChoice.trim() || courseChoice === '..' || courseChoice.toLowerCase() === 'back') {
        console.log(chalk.yellow('Submission cancelled.'));
        rl.close();
        return;
      }

      const courseIndex = parseInt(courseChoice) - 1;
      if (courseIndex < 0 || courseIndex >= displayCourses.length) {
        console.log(chalk.red('Invalid course selection.'));
        rl.close();
        return;
      }

      const selectedCourse = displayCourses[courseIndex]!;
      courseId = selectedCourse.id;
      
      // Clear the input line
      clearLines(1);
      console.log(chalk.green(`✓ Selected course: ${selectedCourse.name}`));
    }

    // Step 2: Select Assignment
    console.log(chalk.cyan('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Step 2: Select Assignment'));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.white('Loading assignments...'));

    const assignmentParams = [
      'include[]=submission',
      'per_page=100'
    ];

    const assignments = await makeCanvasRequest<CanvasAssignment[]>(
      'get',
      `courses/${courseId}/assignments`,
      assignmentParams
    );

    if (!assignments || assignments.length === 0) {
      console.log(chalk.red('Error: No assignments found for this course.'));
      rl.close();
      return;
    }

    // Filter assignments that accept online uploads
    const uploadableAssignments = assignments.filter(a => 
      a.submission_types && a.submission_types.includes('online_upload')
    );

    if (uploadableAssignments.length === 0) {
      console.log(chalk.red('Error: No assignments accept file uploads in this course.'));
      rl.close();
      return;
    }

    // Sort by due date (upcoming first)
    uploadableAssignments.sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    if (uploadableAssignments.length === 1) {
      console.log(chalk.white(`\nFound ${uploadableAssignments.length} assignment that accept file uploads:`));
    }
    else {
      console.log(chalk.white(`\nFound ${uploadableAssignments.length} assignment(s) that accept file uploads:`));
    }
    console.log();

    // Calculate adaptive column widths based on terminal size
    const termWidth = process.stdout.columns || 110;
    const borderOverhead = 16; // borders and padding
    const available = Math.max(90, termWidth - borderOverhead);
    
    // Proportional column distribution
    const colNo = Math.max(3, Math.min(5, Math.floor(available * 0.04)));
    const colType = Math.max(10, Math.min(18, Math.floor(available * 0.14)));
    const colDate = Math.max(16, Math.min(26, Math.floor(available * 0.22)));
    const colStatus = Math.max(12, Math.min(15, Math.floor(available * 0.12)));
    // Name gets remaining space
    const colName = Math.max(20, available - colNo - colType - colDate - colStatus);

    // Top border (rounded)
    console.log(
      chalk.gray('╭─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colType)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colStatus)) + chalk.gray('╮')
    );

    // Header
    console.log(
      chalk.gray('│ ') + chalk.cyan.bold(pad('No', colNo)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Assignment Name', colName)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Type', colType)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Due Date', colDate)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Status', colStatus)) + chalk.gray('│')
    );

    // Header separator
    console.log(
      chalk.gray('├─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colType)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colStatus)) + chalk.gray('┤')
    );

    // Display assignments in table format
    uploadableAssignments.forEach((assignment, index) => {
      const submission = (assignment as any).submission;
      const isSubmitted = submission && submission.submitted_at;
      const statusPlainText = isSubmitted ? '✓ Submitted' : 'Not submitted';
      const statusColored = isSubmitted 
        ? chalk.green(statusPlainText)
        : chalk.yellow(statusPlainText);

      const dueDateText = assignment.due_at 
        ? new Date(assignment.due_at).toLocaleString()
        : 'No due date';

      // Determine assignment type from submission_types
      let typeText = 'Unknown';
      if (assignment.submission_types && assignment.submission_types.length > 0) {
        const types = assignment.submission_types;
        if (types.includes('online_quiz')) {
          typeText = 'Quiz';
        } else if (types.includes('online_upload')) {
          // Check for allowed file extensions
          if (assignment.allowed_extensions && assignment.allowed_extensions.length > 0) {
            const exts = assignment.allowed_extensions.slice(0, 3); // Show max 3 extensions
            const extList = exts.join(', ');
            const suffix = assignment.allowed_extensions.length > 3 ? '...' : '';
            typeText = `${extList}${suffix}`;
          } else {
            typeText = 'Any file';
          }
        } else if (types.includes('online_text_entry')) {
          typeText = 'Text Entry';
        } else if (types.includes('online_url')) {
          typeText = 'URL';
        } else if (types.includes('external_tool')) {
          typeText = 'External Tool';
        } else if (types.includes('media_recording')) {
          typeText = 'Media';
        } else if (types[0]) {
          typeText = types[0].replace(/_/g, ' ');
        }
      }

      // Truncate long assignment names
      let displayName = assignment.name;
      if (displayName.length > colName) {
        displayName = displayName.substring(0, colName - 3) + '...';
      }

      console.log(
        chalk.gray('│ ') + chalk.white(pad(`${index + 1}`, colNo)) + chalk.gray('│ ') +
        chalk.white(pad(displayName, colName)) + chalk.gray('│ ') +
        chalk.blue(pad(typeText, colType)) + chalk.gray('│ ') +
        chalk.gray(pad(dueDateText, colDate)) + chalk.gray('│ ') +
        statusColored + ' '.repeat(Math.max(0, colStatus - statusPlainText.length)) + chalk.gray('│')
      );
    });

    // Bottom border (rounded)
    console.log(
      chalk.gray('╰─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colType)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colStatus)) + chalk.gray('╯')
    );

    let selectedAssignment: CanvasAssignment | undefined;
    
    while (true) {
      const assignmentChoice = await askQuestion(rl, chalk.white('\nEnter assignment number (or ".."/"back" to cancel): '));
      
      if (!assignmentChoice.trim() || assignmentChoice === '..' || assignmentChoice.toLowerCase() === 'back') {
        console.log(chalk.yellow('Submission cancelled.'));
        rl.close();
        return;
      }

      const assignmentIndex = parseInt(assignmentChoice) - 1;
      if (assignmentIndex < 0 || assignmentIndex >= uploadableAssignments.length || isNaN(assignmentIndex)) {
        console.log(chalk.red('Invalid assignment selection. Please try again.'));
        continue;
      }

      selectedAssignment = uploadableAssignments[assignmentIndex]!;
      
      // Clear the input line
      clearLines(1);
      console.log(chalk.green(`✓ Selected assignment: ${selectedAssignment.name}`));
      break;
    }

    // Step 3: Select Files
    console.log(chalk.cyan('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Step 3: Select Files to Submit'));
    console.log(chalk.cyan('-'.repeat(60)));

    let filesToSubmit: string[] = [];

    if (options.file) {
      const filePath = path.isAbsolute(options.file) 
        ? options.file 
        : path.join(process.cwd(), options.file);
      
      filesToSubmit = [filePath];
      console.log(chalk.green(`✓ Using specified file: ${path.basename(filePath)}`));
    } else {
      console.log(chalk.yellow('\n📂 Opening interactive file browser...'));
      
      // Close readline to avoid conflicts with raw mode
      rl.close();
      
      try {
        // Launch file browser directly. If the assignment restricts allowed file
        // extensions, pass them so the browser only shows allowed files.
        const allowed = (selectedAssignment && (selectedAssignment as any).allowed_extensions) || undefined;
        filesToSubmit = await selectFilesKeyboard(rl, process.cwd(), allowed);

        if (!filesToSubmit || filesToSubmit.length === 0) {
          console.log(chalk.yellow('No files selected. Submission cancelled.'));
          return;
        }
      } catch (error) {
        console.error(chalk.red('Error during file selection:'), error);
        // Ensure terminal is reset even on error
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        return;
      }

      // Ensure terminal is completely reset
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      
      // Resume stdin in normal mode
      process.stdin.resume();
      
      // Small delay to ensure terminal state is settled
      await new Promise(resolve => setTimeout(resolve, 150));

      // Recreate readline for confirmation
      rlForConfirm = createReadlineInterface();
    }

    // Step 4: Confirm Submission
    console.log(chalk.cyan('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Step 4: Confirm Submission'));
    console.log(chalk.cyan('-'.repeat(60)));
    
    console.log(chalk.white(`Course: ${courseId}`));
    console.log(chalk.white(`Assignment: ${selectedAssignment.name}`));
    console.log(chalk.white(`Files to submit (${filesToSubmit.length}):`));
    
    filesToSubmit.forEach((file, index) => {
      console.log(chalk.white(`  ${index + 1}. ${path.basename(file)}`));
    });

    const confirmed = await askConfirmation(
      rlForConfirm,
      chalk.bold.yellow('\nProceed with submission?'),
      true
    );

    if (!confirmed) {
      console.log(chalk.yellow('Submission cancelled.'));
      rlForConfirm.close();
      return;
    }

    // Step 5: Upload and Submit
    console.log(chalk.cyan('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Step 5: Uploading Files'));
    console.log(chalk.cyan('-'.repeat(60)));

    const fileIds: number[] = [];

    for (let i = 0; i < filesToSubmit.length; i++) {
      const file = filesToSubmit[i];
      if (!file) continue;

      try {
        console.log(chalk.white(`Uploading ${i + 1}/${filesToSubmit.length}: ${path.basename(file)}...`));
        if (!options.dryRun)
        {
          const fileId = await uploadSingleFileToCanvas(
            courseId,
            selectedAssignment.id,
            file
          );
          fileIds.push(fileId);
        }
        else {
          fileIds.push(1)
        }
        console.log(chalk.green(`✓ Uploaded ${file} successfully`));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`✗ Failed to upload ${path.basename(file)}: ${errorMessage}`));
        
        const continueUpload = await askConfirmation(
          rlForConfirm,
          chalk.yellow('Continue with remaining files?'),
          false
        );

        if (!continueUpload) {
          console.log(chalk.yellow('Upload cancelled.'));
          rlForConfirm.close();
          return;
        }
      }
    }

    if (fileIds.length === 0) {
      console.log(chalk.red('Error: No files were successfully uploaded.'));
      rlForConfirm.close();
      return;
    }

    // Submit the assignment
    console.log(chalk.cyan('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Submitting Assignment'));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.white('Finalizing submission...'));

    try {
      if (!options.dryRun)
      {
        await submitAssignmentWithFiles(
          courseId,
          selectedAssignment.id,
          fileIds
        );
      }

      const config = await import('../lib/config.js').then(c => c.loadConfig());
      const assignmentUrl = `https://${config.domain}/courses/${courseId}/assignments/${selectedAssignment.id}`
      console.log(chalk.cyan('\n' + '='.repeat(60)));
      console.log(chalk.green.bold('Assignment submitted successfully!'));
      console.log(chalk.cyan('='.repeat(60)));
      console.log(chalk.white(`Course ID: ${courseId}`));
      console.log(chalk.white(`Assignment: ${selectedAssignment.name}`));
      console.log(chalk.white(`Files submitted: ${fileIds.length}`));
      console.log(chalk.white('Assignment URL: '), chalk.blue(assignmentUrl))
      console.log(chalk.cyan('='.repeat(60)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.red('\nError submitting assignment: ' + errorMessage));
      console.log(chalk.yellow('Files were uploaded but submission failed. You may need to complete the submission manually in Canvas.'));
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('\nError during submission process:'), errorMessage);
    process.exit(1);
  } finally {
    try {
      rlForConfirm.close();
    } catch {
      // Ignore if already closed
    }
  }
}
