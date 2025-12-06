/**
 * Assignments command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import chalk from 'chalk';
import type { CanvasCourse, CanvasAssignment, ListAssignmentsOptions } from '../types/index.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export async function listAssignments(courseId: string, options: ListAssignmentsOptions): Promise<void> {
  try {
    const course = await makeCanvasRequest<CanvasCourse>('get', `courses/${courseId}`);
    const queryParams = ['include[]=submission', 'include[]=score_statistics', 'per_page=100'];
    console.log(chalk.cyan.bold('\n' + '─'.repeat(60)));
    console.log(chalk.cyan.bold('Loading assignments, please wait...'));
    const assignments = await makeCanvasRequest<CanvasAssignment[]>('get', `courses/${courseId}/assignments`, queryParams);
    if (!assignments || assignments.length === 0) {
      console.log(chalk.red(`Error: No assignments found for course: ${course.name}`));
      return;
    }
    let filteredAssignments = assignments;
    if (options.submitted) {
      filteredAssignments = assignments.filter(a => (a as any).submission && (a as any).submission.submitted_at);
    } else if (options.pending) {
      filteredAssignments = assignments.filter(a => !(a as any).submission || !(a as any).submission.submitted_at);
    }

    console.log(chalk.cyan.bold(`\nAssignments for: ${course.name}`));
    console.log(chalk.green(`Found ${filteredAssignments.length} assignment(s).`));

    // Calculate adaptive column widths based on terminal size
    const terminalWidth = process.stdout.columns || 100;
    const borderOverhead = options.verbose ? 18 : 15; // borders and padding
    const available = Math.max(70, terminalWidth - borderOverhead);
    
    // Proportional column distribution
    const colNo = Math.max(3, Math.min(5, Math.floor(available * 0.04)));
    const colID = Math.max(7, Math.min(10, Math.floor(available * 0.08)));
    const colGrade = Math.max(8, Math.min(12, Math.floor(available * 0.10)));
    const colDue = Math.max(14, Math.min(22, Math.floor(available * 0.20)));
    const colStatus = options.verbose ? Math.max(10, Math.min(14, Math.floor(available * 0.12))) : 0;
    
    // Name column gets remaining space
    const colName = Math.max(15, available - colNo - colID - colGrade - colDue - colStatus);

    // Top border (rounded)
    let topBorder = chalk.gray('╭─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colGrade)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colDue));
    if (options.verbose) {
      topBorder += chalk.gray('┬─') + chalk.gray('─'.repeat(colStatus));
    }
    topBorder += chalk.gray('╮');
    console.log(topBorder);

    // Header
    let header = chalk.gray('│ ') + chalk.cyan.bold(pad('#', colNo)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Assignment Name', colName)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('ID', colID)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Grade', colGrade)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Due Date', colDue));
    if (options.verbose) {
      header += chalk.gray('│ ') + chalk.cyan.bold(pad('Status', colStatus));
    }
    header += chalk.gray('│');
    console.log(header);

    // Header separator
    let separator = chalk.gray('├─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colGrade)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colDue));
    if (options.verbose) {
      separator += chalk.gray('┼─') + chalk.gray('─'.repeat(colStatus));
    }
    separator += chalk.gray('┤');
    console.log(separator);

    // Rows
    filteredAssignments.forEach((assignment, index) => {
      const submission = (assignment as any).submission;
      let gradeDisplay = '';
      let gradeColor = chalk.white;
      
      if (submission && submission.score !== null && submission.score !== undefined) {
        const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
        const total = assignment.points_possible || 0;
        gradeDisplay = `${score}/${total}`;
        const percentage = total > 0 ? (score / total) * 100 : 0;
        if (percentage >= 80) gradeColor = chalk.green;
        else if (percentage >= 50) gradeColor = chalk.yellow;
        else gradeColor = chalk.red;
      } else if (submission && submission.excused) {
        gradeDisplay = 'Excused';
        gradeColor = chalk.blue;
      } else if (submission && submission.missing) {
        gradeDisplay = 'Missing';
        gradeColor = chalk.red;
      } else if (assignment.points_possible) {
        gradeDisplay = `–/${assignment.points_possible}`;
        gradeColor = chalk.gray;
      } else {
        gradeDisplay = 'N/A';
        gradeColor = chalk.gray;
      }

      // Truncate long names
      let displayName = assignment.name;
      if (displayName.length > colName) {
        displayName = displayName.substring(0, colName - 3) + '...';
      }

      const dueDate = assignment.due_at 
        ? new Date(assignment.due_at).toLocaleString() 
        : 'No due date';

      let row = chalk.gray('│ ') + chalk.white(pad((index + 1) + '.', colNo)) + chalk.gray('│ ') +
        chalk.white(pad(displayName, colName)) + chalk.gray('│ ') +
        chalk.white(pad(String(assignment.id), colID)) + chalk.gray('│ ') +
        gradeColor(pad(gradeDisplay, colGrade)) + chalk.gray('│ ') +
        chalk.gray(pad(dueDate, colDue));

      if (options.verbose) {
        const isSubmitted = submission && submission.submitted_at;
        const statusText = isSubmitted ? '✓ Submitted' : 'Not submitted';
        const statusColor = isSubmitted ? chalk.green : chalk.yellow;
        row += chalk.gray('│ ') + statusColor(pad(statusText, colStatus));
      }
      row += chalk.gray('│');
      console.log(row);

      // Verbose details (indented below the row)
      if (options.verbose) {
        if (assignment.description) {
          const cleanDescription = assignment.description
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
          console.log(chalk.gray('│ ') + '     ' + chalk.gray('↳ ') + chalk.dim(cleanDescription + (cleanDescription.length === 100 ? '...' : '')));
        }
      }
    });

    // Bottom border (rounded)
    let bottomBorder = chalk.gray('╰─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colGrade)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colDue));
    if (options.verbose) {
      bottomBorder += chalk.gray('┴─') + chalk.gray('─'.repeat(colStatus));
    }
    bottomBorder += chalk.gray('╯');
    console.log(bottomBorder);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching assignments:'), errorMessage);
    process.exit(1);
  }
}
