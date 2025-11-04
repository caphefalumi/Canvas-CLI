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
    console.log(chalk.cyan('-'.repeat(60)));
    // Column headers
    console.log(
      pad(chalk.bold('No.'), 5) +
      pad(chalk.bold('Course Name'), 35) +
      pad(chalk.bold('ID'), 10) +
      pad(chalk.bold('Code'), 12) +
      (options.verbose ? pad(chalk.bold('Term'), 15) + pad(chalk.bold('Students'), 10) + pad(chalk.bold('Start'), 12) + pad(chalk.bold('End'), 12) + pad(chalk.bold('State'), 12) + pad(chalk.bold('Progress'), 18) : '')
    );
    console.log(chalk.cyan('-'.repeat(60)));
    filteredCourses.forEach((course, index) => {
      let line = pad(chalk.white((index + 1) + '.'), 5) +
        pad(course.name, 35) +
        pad(String(course.id), 10) +
        pad(course.course_code || 'N/A', 12);
      if (options.verbose) {
        line += pad((course as any).term?.name || 'N/A', 15) +
          pad(String((course as any).total_students || 'N/A'), 10) +
          pad(course.start_at ? new Date(course.start_at).toLocaleDateString() : 'N/A', 12) +
          pad(course.end_at ? new Date(course.end_at).toLocaleDateString() : 'N/A', 12) +
          pad(course.workflow_state, 12) +
          pad((course as any).course_progress ? `${(course as any).course_progress.requirement_completed_count || 0}/${(course as any).course_progress.requirement_count || 0}` : 'N/A', 18);
      }
      console.log(line);
    });
    console.log(chalk.cyan('-'.repeat(60)));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching courses:'), errorMessage);
    process.exit(1);
  }
}
