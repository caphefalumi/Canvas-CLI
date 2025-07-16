/**
 * Grades command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import { createReadlineInterface, askQuestion } from '../lib/interactive.js';
import chalk from 'chalk';

export async function showGrades(courseId, options) {
  const rl = createReadlineInterface();
  
  try {
    if (courseId) {
      // Get grades for specific course with assignment details
      await showCourseGrades(courseId, options, rl);
    } else {
      // Interactive course selection for grades
      await showInteractiveGrades(options, rl);
    }
    
  } catch (error) {
    console.error(chalk.red('Error fetching grades: ') + error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function showCourseGrades(courseId, options, rl) {
  // Get course details
  const course = await makeCanvasRequest('get', `courses/${courseId}`);
  
  // Get overall enrollment grades
  const enrollments = await makeCanvasRequest('get', `courses/${courseId}/enrollments`, [
    'user_id=self', 
    'include[]=grades'
  ]);
  
  if (!enrollments || enrollments.length === 0) {
    console.log(chalk.red('Error: No enrollment found for this course.'));
    return;
  }
  
  const enrollment = enrollments[0];
  
  console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
  console.log(chalk.cyan.bold('Grades for: ') + course.name);
  console.log(chalk.cyan('-'.repeat(60)));
  console.log(chalk.white('Course Overview:'));
  console.log(chalk.white('   Current Score: ') + (enrollment.grades?.current_score || 'N/A') + '%');
  console.log(chalk.white('   Final Score: ') + (enrollment.grades?.final_score || 'N/A') + '%');
  console.log(chalk.white('   Current Grade: ') + (enrollment.grades?.current_grade || 'N/A'));
  console.log(chalk.white('   Final Grade: ') + (enrollment.grades?.final_grade || 'N/A'));
  
  // Get assignment grades
  console.log(chalk.cyan('\nLoading assignment grades...'));
  const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
    'include[]=submission',
    'order_by=due_at',
    'per_page=100'
  ]);
  
  if (!assignments || assignments.length === 0) {
    console.log(chalk.yellow('No assignments found for this course.'));
    return;
  }
  
  // Filter assignments with grades
  const gradedAssignments = assignments.filter(assignment => {
    const submission = assignment.submission;
    return submission && (
      submission.score !== null || 
      submission.excused || 
      submission.missing ||
      submission.grade
    );
  });
  
  if (gradedAssignments.length === 0) {
    console.log(chalk.yellow('No graded assignments found.'));
    return;
  }
  
  console.log(chalk.green('Success: Grades loaded.'));
  console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
  console.log(chalk.cyan.bold(`Assignment Grades (${gradedAssignments.length} graded):`));
  console.log(chalk.cyan('-'.repeat(60)));
  gradedAssignments.forEach((assignment, index) => {
    const submission = assignment.submission;
    let gradeDisplay = '';
    let gradeColor = chalk.white;
    
    if (submission.score !== null && submission.score !== undefined) {
      const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
      const total = assignment.points_possible || 0;
      gradeDisplay = `${score}/${total} pts`;
      
      // Color coding based on percentage
      if (total > 0) {
        const percentage = (submission.score / total) * 100;
        if (percentage >= 90) gradeColor = chalk.green;
        else if (percentage >= 80) gradeColor = chalk.cyan;
        else if (percentage >= 70) gradeColor = chalk.yellow;
        else if (percentage >= 60) gradeColor = chalk.magenta;
        else gradeColor = chalk.red;
      }
      
      // Add letter grade if available
      if (submission.grade && isNaN(submission.grade)) {
        gradeDisplay = `${submission.grade} (${gradeDisplay})`;
      }
    } else if (submission.excused) {
      gradeDisplay = 'Excused';
      gradeColor = chalk.blue;
    } else if (submission.missing) {
      gradeDisplay = 'Missing';
      gradeColor = chalk.red;
    }
    
    console.log(chalk.white(`${index + 1}. ${assignment.name}`));
    console.log('   Grade: ' + gradeColor(gradeDisplay));
    
    if (submission.submitted_at) {
      console.log('   Submitted: ' + new Date(submission.submitted_at).toLocaleDateString());
    }
    
    if (assignment.due_at) {
      console.log('   Due: ' + new Date(assignment.due_at).toLocaleDateString());
    }
    
    if (options.verbose && submission.grader_comments) {
      console.log('   Comments: ' + submission.grader_comments);
    }
    
    console.log('');
  });
}

async function showInteractiveGrades(options, rl) {
  // Get all courses with enrollment information
  const courses = await makeCanvasRequest('get', 'courses', [
    'enrollment_state=active',
    'include[]=enrollments',
    'include[]=favorites',
    'include[]=total_scores'
  ]);

  if (!courses || courses.length === 0) {
    console.log(chalk.red('Error: No courses found.'));
    return;
  }

  // Move declaration above first use
  const coursesWithGrades = courses.filter(course => 
    course.enrollments && course.enrollments.length > 0
  );

  // Show courses overview first
  console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
  console.log(chalk.cyan.bold('Grades Overview'));
  console.log(chalk.cyan('-'.repeat(60)));
  console.log(chalk.white(`Found ${coursesWithGrades.length} enrolled course(s):\n`));
  
  coursesWithGrades.forEach((course, index) => {
    let gradeColor = chalk.gray;
    const enrollment = course.enrollments[0];
    const currentScore = enrollment.grades?.current_score;
    if (currentScore !== null && currentScore !== undefined) {
      if (currentScore >= 90) gradeColor = chalk.green;
      else if (currentScore >= 80) gradeColor = chalk.cyan;
      else if (currentScore >= 70) gradeColor = chalk.yellow;
      else if (currentScore >= 60) gradeColor = chalk.magenta;
      else gradeColor = chalk.red;
    }
    console.log(chalk.white(`${index + 1}. ${course.name}`));
    if (enrollment.grades) {
      console.log('   Current: ' + gradeColor(`${currentScore || 'N/A'}% (${enrollment.grades.current_grade || 'N/A'})`));
    } else {
      console.log('   Current: ' + chalk.gray('Grades not available'));
    }
    console.log('');
  });
  
  // Ask if user wants to see detailed grades for a specific course
  const viewDetailed = await askQuestion(rl, 'View detailed grades for a specific course? (Y/n): ');
  
  if (viewDetailed.toLowerCase() === 'n' || viewDetailed.toLowerCase() === 'no') {
    return;
  }
  
  const courseChoice = await askQuestion(rl, '\nEnter course number for detailed grades: ');
  const courseIndex = parseInt(courseChoice) - 1;
  
  if (courseIndex >= 0 && courseIndex < coursesWithGrades.length) {
    const selectedCourse = coursesWithGrades[courseIndex];
    console.log(chalk.green(`\nSelected: ${selectedCourse.name}`));
    await showCourseGrades(selectedCourse.id, options, rl);
  } else {
    console.log(chalk.red('Invalid course selection.'));
  }
}
