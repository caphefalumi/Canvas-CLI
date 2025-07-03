/**
 * List courses command
 */

const { makeCanvasRequest } = require('../lib/api-client');

async function listCourses(options) {
  try {
    const queryParams = [];
    
    // Always show only active courses
    queryParams.push('enrollment_state=active');
    
    // Include additional course information
    queryParams.push('include[]=term');
    queryParams.push('include[]=course_progress');
    queryParams.push('include[]=total_students');
    queryParams.push('include[]=favorites'); // Include favorite status
    
    const courses = await makeCanvasRequest('get', 'courses', queryParams);
    
    if (!courses || courses.length === 0) {
      console.log('No courses found.');
      return;
    }
    
    // By default, show only starred courses unless -a flag is used
    let filteredCourses = courses;
    if (!options.all) {
      filteredCourses = courses.filter(course => course.is_favorite);
      
      if (filteredCourses.length === 0) {
        console.log('No starred courses found. Use -a to see all courses.');
        return;
      }
    }
    
    const courseLabel = options.all ? 'enrolled course(s)' : 'starred course(s)';
    console.log(`Found ${filteredCourses.length} ${courseLabel}:\n`);
    
    filteredCourses.forEach((course, index) => {
      const starIcon = course.is_favorite ? '⭐ ' : '';
      console.log(`${index + 1}. ${starIcon}${course.name}`);
      console.log(`   ID: ${course.id}`);
      console.log(`   Code: ${course.course_code || 'N/A'}`);
      
      if (options.verbose) {
        console.log(`   Term: ${course.term?.name || 'N/A'}`);
        console.log(`   Students: ${course.total_students || 'N/A'}`);
        console.log(`   Start Date: ${course.start_at ? new Date(course.start_at).toLocaleDateString() : 'N/A'}`);
        console.log(`   End Date: ${course.end_at ? new Date(course.end_at).toLocaleDateString() : 'N/A'}`);
        console.log(`   Workflow State: ${course.workflow_state}`);
        
        if (course.course_progress) {
          console.log(`   Progress: ${course.course_progress.requirement_completed_count || 0}/${course.course_progress.requirement_count || 0} requirements`);
        }
      }
      
      console.log(''); // Empty line between courses
    });
    
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    process.exit(1);
  }
}

module.exports = {
  listCourses
};
