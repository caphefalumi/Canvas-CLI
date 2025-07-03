/**
 * Grades command
 */

const { makeCanvasRequest } = require('../lib/api-client');

async function showGrades(courseId, options) {
  try {
    if (courseId) {
      // Get grades for specific course
      const enrollments = await makeCanvasRequest('get', `courses/${courseId}/enrollments`, ['user_id=self', 'include[]=grades']);
      
      if (!enrollments || enrollments.length === 0) {
        console.log('No enrollment found for this course.');
        return;
      }
      
      const enrollment = enrollments[0];
      console.log(`Grades for course: ${enrollment.course_id}`);
      console.log(`Current Score: ${enrollment.grades?.current_score || 'N/A'}%`);
      console.log(`Final Score: ${enrollment.grades?.final_score || 'N/A'}%`);
      console.log(`Current Grade: ${enrollment.grades?.current_grade || 'N/A'}`);
      console.log(`Final Grade: ${enrollment.grades?.final_grade || 'N/A'}`);
    } else {
      // Get grades for all courses
      const courses = await makeCanvasRequest('get', 'courses', [
        'enrollment_state=active', 
        'include[]=enrollments',
        'include[]=total_scores'
      ]);
      
      if (!courses || courses.length === 0) {
        console.log('No courses found.');
        return;
      }
      
      console.log('Grades Summary:\n');
      
      courses.forEach((course, index) => {
        console.log(`${index + 1}. ${course.name}`);
        console.log(`   ID: ${course.id}`);
        
        if (course.enrollments && course.enrollments.length > 0) {
          const enrollment = course.enrollments[0];
          if (enrollment.grades) {
            console.log(`   Current Score: ${enrollment.grades.current_score || 'N/A'}%`);
            console.log(`   Final Score: ${enrollment.grades.final_score || 'N/A'}%`);
            console.log(`   Current Grade: ${enrollment.grades.current_grade || 'N/A'}`);
          } else {
            console.log(`   Grades: Not available`);
          }
        } else {
          console.log(`   Enrollment: Not found`);
        }
        
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error fetching grades:', error.message);
    process.exit(1);
  }
}

module.exports = {
  showGrades
};
