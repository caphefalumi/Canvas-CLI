/**
 * List courses command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import chalk from 'chalk';
import type { CanvasCourse, ListCoursesOptions } from '../types/index.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export async function listCourses(options: ListCoursesOptions): Promise<void> {
  try {
    const queryParams: string[] = [];
    queryParams.push('enrollment_state=active');
    queryParams.push('include[]=term');
    queryParams.push('include[]=course_progress');
    queryParams.push('include[]=total_students');
    queryParams.push('include[]=favorites');

    console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Loading courses, please wait...'));
    const courses = await makeCanvasRequest<CanvasCourse[]>('get', 'courses', queryParams);
    if (!courses || courses.length === 0) {
      console.log(chalk.red('Error: No courses found.'));
      return;
    }
    let filteredCourses = courses;
    if (!options.all) {
      filteredCourses = courses.filter(course => course.is_favorite);
      if (filteredCourses.length === 0) {
        console.log(chalk.red('Error: No starred courses found. Use -a to see all courses.'));
        return;
      }
    }
    const courseLabel = options.all ? 'enrolled course(s)' : 'starred course(s)';
    console.log(chalk.green(`Success: Found ${filteredCourses.length} ${courseLabel}.`));
    // Build a boxed table similar to grades/submit style
    const total = filteredCourses.length;
    const colNo = Math.max(3, String(total).length + 1);
    const colID = Math.max(6, ...filteredCourses.map(c => String(c.id).length));

    const terminalWidth = process.stdout.columns || 80;
    // Overhead for borders and other columns: approximate fixed chars
    // We have columns: #, Name, ID
    const overhead = 12 + colNo + colID; // approximation for borders and paddings
    const availableForName = Math.max(20, terminalWidth - overhead);

    // Determine max course name length but don't exceed availableForName
    const maxNameLength = Math.max(11, ...filteredCourses.map(c => c.name.length));
    const colName = Math.min(maxNameLength, availableForName);

    // Top border
    console.log(
      chalk.gray('┌─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┐')
    );

    // Header
    console.log(
      chalk.gray('│ ') + chalk.cyan.bold(pad('#', colNo)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Course Name', colName)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('ID', colID)) + chalk.gray('│')
    );

    // Header separator
    console.log(
      chalk.gray('├─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┤')
    );

    // Rows
    filteredCourses.forEach((course, index) => {
      let displayName = course.name;
      if (displayName.length > colName) displayName = displayName.substring(0, colName - 3) + '...';

      console.log(
        chalk.gray('│ ') + chalk.white(pad((index + 1) + '.', colNo)) + chalk.gray('│ ') +
        chalk.white(pad(displayName, colName)) + chalk.gray('│ ') +
        chalk.white(pad(String(course.id), colID)) + chalk.gray('│')
      );
    });

    // Bottom border
    console.log(
      chalk.gray('└─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colName)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colID)) + chalk.gray('┘')
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching courses:'), errorMessage);
    process.exit(1);
  }
}
