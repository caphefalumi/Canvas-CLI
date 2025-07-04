/**
 * Assignments command
 */

const { makeCanvasRequest } = require('../lib/api-client');

async function listAssignments(courseId, options) {
  try {
    // First get course information to display course name
    const course = await makeCanvasRequest('get', `courses/${courseId}`);
    
    const queryParams = ['include[]=submission', 'include[]=score_statistics', 'per_page=100'];
    
    const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, queryParams);
    
    if (!assignments || assignments.length === 0) {
      console.log(`No assignments found for course: ${course.name}`);
      return;
    }
    
    // Filter assignments based on options
    let filteredAssignments = assignments;
    if (options.submitted) {
      filteredAssignments = assignments.filter(a => a.submission && a.submission.submitted_at);
    } else if (options.pending) {
      filteredAssignments = assignments.filter(a => !a.submission || !a.submission.submitted_at);
    }
    
    // Display course information prominently
    console.log(`📚 Course: ${course.name}`);
    console.log(`📝 Found ${filteredAssignments.length} assignment(s):\n`);
    
    filteredAssignments.forEach((assignment, index) => {
      const submission = assignment.submission;
      const isSubmitted = submission && submission.submitted_at;
      const submissionStatus = isSubmitted ? '✅' : '❌';
      
      // Format grade like Canvas web interface with enhanced formatting
      let gradeDisplay = '';
      let gradeColor = '';
      
      if (submission && submission.score !== null && submission.score !== undefined) {
        // Format score to remove unnecessary decimals (e.g., 3.0 becomes 3)
        const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
        const total = assignment.points_possible || 0;
        gradeDisplay = `${score}/${total}`;
        
        // Add color coding based on score percentage
        if (total > 0) {
          const percentage = (submission.score / total) * 100;
          if (percentage >= 90) gradeColor = '\x1b[32m'; // Green for A
          else if (percentage >= 80) gradeColor = '\x1b[36m'; // Cyan for B  
          else if (percentage >= 70) gradeColor = '\x1b[33m'; // Yellow for C
          else if (percentage >= 60) gradeColor = '\x1b[35m'; // Magenta for D
          else gradeColor = '\x1b[31m'; // Red for F
        }
      } else if (submission && submission.excused) {
        gradeDisplay = 'Excused';
        gradeColor = '\x1b[34m'; // Blue for excused
      } else if (submission && submission.missing) {
        gradeDisplay = 'Missing';
        gradeColor = '\x1b[31m'; // Red for missing
      } else if (assignment.points_possible) {
        gradeDisplay = `–/${assignment.points_possible}`;
        gradeColor = '\x1b[90m'; // Gray for not graded yet
      } else {
        gradeDisplay = 'N/A';
        gradeColor = '\x1b[90m'; // Gray for N/A
      }
      
      // Handle letter grades if present
      if (submission && submission.grade && isNaN(submission.grade)) {
        gradeDisplay = submission.grade + (assignment.points_possible ? ` (${gradeDisplay})` : '');
      }
        console.log(`${index + 1}. ${submissionStatus} ${assignment.name}`);
      console.log(`   Assignment ID: ${assignment.id}`);
      console.log(`   Grade: ${gradeColor}${gradeDisplay} pts\x1b[0m`);
      console.log(`   Due: ${assignment.due_at ? new Date(assignment.due_at).toLocaleString() : 'No due date'}`);
      
      if (isSubmitted) {
        console.log(`   Submitted: ${new Date(submission.submitted_at).toLocaleString()}`);
        if (submission.workflow_state) {
          // Color code submission status
          let statusColor = '';
          switch(submission.workflow_state) {
            case 'graded': statusColor = '\x1b[32m'; break; // Green
            case 'submitted': statusColor = '\x1b[33m'; break; // Yellow
            case 'pending_review': statusColor = '\x1b[36m'; break; // Cyan
            default: statusColor = '\x1b[37m'; // White
          }
          console.log(`   Status: ${statusColor}${submission.workflow_state}\x1b[0m`);
        }
      } else {
        console.log(`   Status: \x1b[31mNot submitted\x1b[0m`); // Red for not submitted
      }
      
      if (options.verbose) {
        if (assignment.description) {
          // Strip HTML tags and clean up description
          const cleanDescription = assignment.description
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ')    // Replace multiple whitespace with single space
            .trim()                  // Remove leading/trailing whitespace
            .substring(0, 150);      // Limit to 150 characters
          console.log(`   Description: ${cleanDescription}${cleanDescription.length === 150 ? '...' : ''}`);
        } else {
          console.log(`   Description: N/A`);
        }
        console.log(`   Submission Types: ${assignment.submission_types?.join(', ') || 'N/A'}`);
        console.log(`   Published: ${assignment.published ? 'Yes' : 'No'}`);
        if (assignment.points_possible) {
          console.log(`   Points Possible: ${assignment.points_possible}`);
        }
        if (submission && submission.attempt) {
          console.log(`   Attempt: ${submission.attempt}`);
        }
      }
      
      console.log('');
    });
    
  } catch (error) {
    console.error('Error fetching assignments:', error.message);
    process.exit(1);
  }
}

module.exports = {
  listAssignments
};
