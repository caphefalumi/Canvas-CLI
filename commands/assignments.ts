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
    console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
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
    console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold(`Assignments for: ${course.name}`));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.green(`Success: Found ${filteredAssignments.length} assignment(s).`));
    console.log(chalk.cyan('-'.repeat(60)));
    // Column headers
    console.log(
      pad(chalk.bold('No.'), 5) +
      pad(chalk.bold('Assignment Name'), 35) +
      pad(chalk.bold('ID'), 10) +
      pad(chalk.bold('Grade'), 12) +
      pad(chalk.bold('Due'), 22) +
      (options.verbose ? pad(chalk.bold('Status'), 12) : '')
    );
    console.log(chalk.cyan('-'.repeat(60)));
    filteredAssignments.forEach((assignment, index) => {
      const submission = (assignment as any).submission;
      let gradeDisplay = '';
      if (submission && submission.score !== null && submission.score !== undefined) {
        const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
        const total = assignment.points_possible || 0;
        gradeDisplay = `${score}/${total}`;
      } else if (submission && submission.excused) {
        gradeDisplay = 'Excused';
      } else if (submission && submission.missing) {
        gradeDisplay = 'Missing';
      } else if (assignment.points_possible) {
        gradeDisplay = `–/${assignment.points_possible}`;
      } else {
        gradeDisplay = 'N/A';
      }
      let line = pad(chalk.white((index + 1) + '.'), 5) +
        pad(assignment.name, 35) +
        pad(String(assignment.id), 10) +
        pad(gradeDisplay, 12) +
        pad(assignment.due_at ? new Date(assignment.due_at).toLocaleString() : 'No due date', 22);
      if (options.verbose) {
        let status = 'Not submitted';
        if (submission && submission.submitted_at) {
          status = 'Submitted';
        }
        line += pad(status, 12);
      }
      console.log(line);
      if (options.verbose) {
        if (assignment.description) {
          const cleanDescription = assignment.description
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 150);
          console.log('   ' + chalk.gray('Description: ') + cleanDescription + (cleanDescription.length === 150 ? '...' : ''));
        } else {
          console.log('   ' + chalk.gray('Description: N/A'));
        }
        console.log('   ' + chalk.gray('Submission Types: ') + (assignment.submission_types?.join(', ') || 'N/A'));
        console.log('   ' + chalk.gray('Published: ') + (assignment.has_submitted_submissions ? 'Yes' : 'No'));
        if (assignment.points_possible) {
          console.log('   ' + chalk.gray('Points Possible: ') + assignment.points_possible);
        }
        if (submission && submission.attempt) {
          console.log('   ' + chalk.gray('Attempt: ') + submission.attempt);
        }
      }
      console.log('');
    });
    console.log(chalk.cyan('-'.repeat(60)));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching assignments:'), errorMessage);
    process.exit(1);
  }
}
