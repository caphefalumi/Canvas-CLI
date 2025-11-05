/**
 * Grades command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import chalk from 'chalk';
import type { CanvasCourse, CanvasEnrollment, ShowGradesOptions } from '../types/index.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export async function showGrades(courseId?: string, options: ShowGradesOptions = {}): Promise<void> {
  try {
    if (courseId) {
      // Show grades for specific course
      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Loading course grades, please wait...'));
      
      const course = await makeCanvasRequest<CanvasCourse>('get', `courses/${courseId}`);
      const enrollments = await makeCanvasRequest<CanvasEnrollment[]>(
        'get',
        `courses/${courseId}/enrollments`,
        ['user_id=self', 'include[]=total_scores']
      );

      if (!enrollments || enrollments.length === 0) {
        console.log(chalk.red('Error: No enrollment found for this course.'));
        return;
      }

      const enrollment = enrollments[0];
      const grades = enrollment?.grades;

      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold(`Grades for: ${course.name}`));
      console.log(chalk.cyan('-'.repeat(60)));

      if (grades) {
        console.log(chalk.white('Current Score: ') + chalk.bold.green(grades.current_score !== null ? `${grades.current_score}%` : 'N/A'));
        console.log(chalk.white('Final Score:   ') + chalk.bold.green(grades.final_score !== null ? `${grades.final_score}%` : 'N/A'));
        console.log(chalk.white('Current Grade: ') + chalk.bold.green(grades.current_grade || 'N/A'));
        console.log(chalk.white('Final Grade:   ') + chalk.bold.green(grades.final_grade || 'N/A'));
      } else {
        console.log(chalk.yellow('No grades available for this course.'));
      }

      if (options.verbose && enrollment) {
        console.log(chalk.cyan('\n' + '-'.repeat(60)));
        console.log(chalk.cyan.bold('Enrollment Details:'));
        console.log(chalk.white('Enrollment ID: ') + enrollment.id);
        console.log(chalk.white('Type:          ') + enrollment.type);
        console.log(chalk.white('State:         ') + enrollment.enrollment_state);
      }

      console.log(chalk.cyan('-'.repeat(60)));
    } else {
      // Show grades for all courses
      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Loading grades for all courses, please wait...'));
      
      const courses = await makeCanvasRequest<CanvasCourse[]>('get', 'courses', [
        'enrollment_state=active',
        'include[]=total_scores',
        'include[]=current_grading_period_scores',
        'per_page=100'
      ]);

      if (!courses || courses.length === 0) {
        console.log(chalk.red('Error: No courses found.'));
        return;
      }

      // Get enrollments with grades for each course
      const coursesWithGrades: Array<{
        course: CanvasCourse;
        enrollment: CanvasEnrollment | null;
      }> = [];

      for (const course of courses) {
        try {
          const enrollments = await makeCanvasRequest<CanvasEnrollment[]>(
            'get',
            `courses/${course.id}/enrollments`,
            ['user_id=self', 'include[]=total_scores']
          );
          coursesWithGrades.push({
            course,
            enrollment: enrollments[0] || null
          });
        } catch (error) {
          coursesWithGrades.push({
            course,
            enrollment: null
          });
        }
      }

      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Grades Summary'));
      console.log(chalk.cyan('-'.repeat(60)));
      console.log(chalk.green(`Success: Found ${coursesWithGrades.length} course(s).`));
      console.log(chalk.cyan('-'.repeat(60)));

      // Column headers
      if (options.verbose) {
        console.log(
          pad(chalk.bold('No.'), 5) +
          pad(chalk.bold('Course Name'), 35) +
          pad(chalk.bold('ID'), 10) +
          pad(chalk.bold('Current Score'), 15) +
          pad(chalk.bold('Final Score'), 15) +
          pad(chalk.bold('Current Grade'), 15) +
          pad(chalk.bold('Final Grade'), 15)
        );
      } else {
        console.log(
          pad(chalk.bold('No.'), 5) +
          pad(chalk.bold('Course Name'), 35) +
          pad(chalk.bold('ID'), 10) +
          pad(chalk.bold('Current'), 12) +
          pad(chalk.bold('Final'), 12)
        );
      }
      console.log(chalk.cyan('-'.repeat(60)));

      coursesWithGrades.forEach((item, index) => {
        const { course, enrollment } = item;
        const grades = enrollment?.grades;

        const currentScore = grades?.current_score !== null && grades?.current_score !== undefined
          ? `${grades.current_score}%`
          : 'N/A';
        const finalScore = grades?.final_score !== null && grades?.final_score !== undefined
          ? `${grades.final_score}%`
          : 'N/A';
        const currentGrade = grades?.current_grade || 'N/A';
        const finalGrade = grades?.final_grade || 'N/A';

        if (options.verbose) {
          console.log(
            pad(chalk.white((index + 1) + '.'), 5) +
            pad(course.name, 35) +
            pad(String(course.id), 10) +
            pad(currentScore, 15) +
            pad(finalScore, 15) +
            pad(currentGrade, 15) +
            pad(finalGrade, 15)
          );
        } else {
          console.log(
            pad(chalk.white((index + 1) + '.'), 5) +
            pad(course.name, 35) +
            pad(String(course.id), 10) +
            pad(currentScore, 12) +
            pad(finalScore, 12)
          );
        }
      });

      console.log(chalk.cyan('-'.repeat(60)));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error fetching grades:'), errorMessage);
    process.exit(1);
  }
}
