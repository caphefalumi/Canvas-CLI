/**
 * Announcements command
 */

const { makeCanvasRequest } = require('../lib/api-client');

async function showAnnouncements(courseId, options) {
  try {
    if (courseId) {
      // Get announcements for specific course
      const announcements = await makeCanvasRequest('get', `courses/${courseId}/discussion_topics`, [
        'only_announcements=true',
        `per_page=${options.limit}`
      ]);
      
      if (!announcements || announcements.length === 0) {
        console.log('No announcements found for this course.');
        return;
      }
      
      console.log(`Recent ${announcements.length} announcement(s) for course ${courseId}:\n`);
      
      announcements.forEach((announcement, index) => {
        console.log(`${index + 1}. ${announcement.title}`);
        console.log(`   Posted: ${announcement.posted_at ? new Date(announcement.posted_at).toLocaleString() : 'N/A'}`);
        console.log(`   Author: ${announcement.author?.display_name || 'Unknown'}`);
        
        if (announcement.message) {
          // Remove HTML tags and truncate
          const message = announcement.message.replace(/<[^>]*>/g, '').substring(0, 200);
          console.log(`   Message: ${message}${announcement.message.length > 200 ? '...' : ''}`);
        }
        
        console.log('');
      });
      
    } else {
      // Get announcements for all enrolled courses
      const courses = await makeCanvasRequest('get', 'courses', ['enrollment_state=active']);
      
      if (!courses || courses.length === 0) {
        console.log('No courses found.');
        return;
      }
      
      console.log('Getting announcements from all enrolled courses...\n');
      
      for (const course of courses.slice(0, 3)) { // Limit to first 3 courses to avoid too many requests
        try {
          const announcements = await makeCanvasRequest('get', `courses/${course.id}/discussion_topics`, [
            'only_announcements=true',
            'per_page=2'
          ]);
          
          if (announcements && announcements.length > 0) {
            console.log(`📢 ${course.name}:`);
            announcements.forEach((announcement) => {
              console.log(`  • ${announcement.title} (${announcement.posted_at ? new Date(announcement.posted_at).toLocaleDateString() : 'No date'})`);
            });
            console.log('');
          }
        } catch (error) {
          // Skip courses that don't allow access to announcements
          continue;
        }
      }
    }
    
  } catch (error) {
    console.error('Error fetching announcements:', error.message);
    process.exit(1);
  }
}

module.exports = {
  showAnnouncements
};
