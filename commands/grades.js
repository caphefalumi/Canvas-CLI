/**
 * Grades command
 */

const { makeCanvasRequest } = require('../lib/api-client');
const { createReadlineInterface, askQuestion } = require('../lib/interactive');

async function showGrades(courseId, options) {
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
    console.error('Error fetching grades:', error.message);
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
    console.log('No enrollment found for this course.');
    return;
  }
  
  const enrollment = enrollments[0];
  
  console.log(`\n📚 Grades for: ${course.name}`);
  console.log(`📊 Course Overview:`);
  console.log(`   Current Score: ${enrollment.grades?.current_score || 'N/A'}%`);
  console.log(`   Final Score: ${enrollment.grades?.final_score || 'N/A'}%`);
  console.log(`   Current Grade: ${enrollment.grades?.current_grade || 'N/A'}`);
  console.log(`   Final Grade: ${enrollment.grades?.final_grade || 'N/A'}`);
  
  // Get assignment grades
  console.log('\n📝 Loading assignment grades...');
  const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
    'include[]=submission',
    'order_by=due_at',
    'per_page=100'
  ]);
  
  if (!assignments || assignments.length === 0) {
    console.log('No assignments found for this course.');
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
    console.log('No graded assignments found.');
    return;
  }
  
  console.log(`\n📋 Assignment Grades (${gradedAssignments.length} graded):`);
  gradedAssignments.forEach((assignment, index) => {
    const submission = assignment.submission;
    let gradeDisplay = '';
    let gradeColor = '';
    
    if (submission.score !== null && submission.score !== undefined) {
      const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
      const total = assignment.points_possible || 0;
      gradeDisplay = `${score}/${total} pts`;
      
      // Color coding based on percentage
      if (total > 0) {
        const percentage = (submission.score / total) * 100;
        if (percentage >= 90) gradeColor = '\x1b[32m'; // Green
        else if (percentage >= 80) gradeColor = '\x1b[36m'; // Cyan
        else if (percentage >= 70) gradeColor = '\x1b[33m'; // Yellow
        else if (percentage >= 60) gradeColor = '\x1b[35m'; // Magenta
        else gradeColor = '\x1b[31m'; // Red
      }
      
      // Add letter grade if available
      if (submission.grade && isNaN(submission.grade)) {
        gradeDisplay = `${submission.grade} (${gradeDisplay})`;
      }
    } else if (submission.excused) {
      gradeDisplay = 'Excused';
      gradeColor = '\x1b[34m'; // Blue
    } else if (submission.missing) {
      gradeDisplay = 'Missing';
      gradeColor = '\x1b[31m'; // Red
    }
    
    console.log(`${index + 1}. ${assignment.name}`);
    console.log(`   Grade: ${gradeColor}${gradeDisplay}\x1b[0m`);
    
    if (submission.submitted_at) {
      console.log(`   Submitted: ${new Date(submission.submitted_at).toLocaleDateString()}`);
    }
    
    if (assignment.due_at) {
      console.log(`   Due: ${new Date(assignment.due_at).toLocaleDateString()}`);
    }
    
    if (options.verbose && submission.grader_comments) {
      console.log(`   Comments: ${submission.grader_comments}`);
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
    console.log('No courses found.');
    return;
  }
  
  // Show courses overview first
  console.log('📊 Grades Overview:\n');
  
  const coursesWithGrades = courses.filter(course => 
    course.enrollments && course.enrollments.length > 0
  );
  
  console.log(`Found ${coursesWithGrades.length} enrolled course(s):\n`);
  
  coursesWithGrades.forEach((course, index) => {
    const starIcon = course.is_favorite ? '⭐ ' : '';
    console.log(`${index + 1}. ${starIcon}${course.name}`);
    
    if (course.enrollments && course.enrollments.length > 0) {
      const enrollment = course.enrollments[0];
      if (enrollment.grades) {
        const currentScore = enrollment.grades.current_score;
        const currentGrade = enrollment.grades.current_grade;
        
        // Color code the grade
        let gradeColor = '\x1b[90m'; // Gray default
        if (currentScore !== null && currentScore !== undefined) {
          if (currentScore >= 90) gradeColor = '\x1b[32m'; // Green
          else if (currentScore >= 80) gradeColor = '\x1b[36m'; // Cyan
          else if (currentScore >= 70) gradeColor = '\x1b[33m'; // Yellow
          else if (currentScore >= 60) gradeColor = '\x1b[35m'; // Magenta
          else gradeColor = '\x1b[31m'; // Red
        }
        
        console.log(`   Current: ${gradeColor}${currentScore || 'N/A'}% (${currentGrade || 'N/A'})\x1b[0m`);
      } else {
        console.log(`   Current: \x1b[90mGrades not available\x1b[0m`);
      }
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
    console.log(`\n✅ Selected: ${selectedCourse.name}`);
    await showCourseGrades(selectedCourse.id, options, rl);
  } else {
    console.log('Invalid course selection.');
  }
}

module.exports = {
  showGrades
};
