#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config(); // Load environment variables from .env file
const program = new Command();

/**
 * Load configuration from environment variables
 */
function loadConfig() {
  try {
    let domain = process.env.CANVAS_DOMAIN;
    const token = process.env.CANVAS_API_TOKEN;
    
    if (!domain || !token) {
      console.error('Missing required environment variables:');
      if (!domain) console.error('  CANVAS_DOMAIN is not set');
      if (!token) console.error('  CANVAS_API_TOKEN is not set');
      console.error('\nPlease create a .env file with:');
      console.error('CANVAS_DOMAIN=your-canvas-domain.instructure.com');
      console.error('CANVAS_API_TOKEN=your-api-token');
      process.exit(1);
    }
    
    // Clean up domain - remove https:// and trailing slashes
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    return { domain, token };
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Get the Canvas instance configuration
 */
function getInstanceConfig() {
  const config = loadConfig();
  return config;
}

/**
 * Make Canvas API request
 */
async function makeCanvasRequest(method, endpoint, queryParams = [], requestBody = null) {
  const instanceConfig = getInstanceConfig();
  
  // Construct the full URL
  const baseUrl = `https://${instanceConfig.domain}/api/v1`;
  const url = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
  
  // Setup request configuration
  const config = {
    method: method.toLowerCase(),
    url: url,
    headers: {
      'Authorization': `Bearer ${instanceConfig.token}`,
      'Content-Type': 'application/json'
    }
  };
  
  // Add query parameters
  if (queryParams.length > 0) {
    const params = new URLSearchParams();
    queryParams.forEach(param => {
      const [key, value] = param.split('=', 2);
      params.append(key, value || '');
    });
    config.params = params;
  }
  
  // Add request body for POST/PUT requests
  if (requestBody && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
    if (requestBody.startsWith('@')) {
      // Read from file
      const filename = requestBody.substring(1);
      try {
        config.data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      } catch (error) {
        console.error(`Error reading file ${filename}: ${error.message}`);
        process.exit(1);
      }
    } else {
      // Parse JSON string
      try {
        config.data = JSON.parse(requestBody);
      } catch (error) {
        console.error(`Error parsing JSON: ${error.message}`);
        process.exit(1);
      }
    }
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error(`Request failed: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Create query command with aliases
 */
function createQueryCommand(method) {
  return program
    .command(method)
    .alias(method === 'query' ? 'q' : method.charAt(0))
    .argument('<endpoint>', 'Canvas API endpoint to query')
    .option('-q, --query <param>', 'Query parameter (can be used multiple times)', [])
    .option('-d, --data <data>', 'Request body (JSON string or @filename)')
    .description(`${method.toUpperCase()} request to Canvas API`)
    .action(async (endpoint, options) => {
      const data = await makeCanvasRequest(method, endpoint, options.query, options.data);
      console.log(JSON.stringify(data, null, 2));
    });
}

// Setup CLI program
program
  .name('canvas')
  .description('Canvas API Command Line Tool')
  .version('1.0.0');

// Create query commands
createQueryCommand('get');
createQueryCommand('post');
createQueryCommand('put');
createQueryCommand('delete');
createQueryCommand('query');

// Add list command to show enrolled courses
program
  .command('list')
  .alias('l')
  .description('List starred courses (default) or all courses with -a')
  .option('-a, --all', 'Show all enrolled courses instead of just starred ones')
  .option('-v, --verbose', 'Show detailed course information')
  .action(async (options) => {    try {
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
  });

// Add config command to help users set up their configuration
program
  .command('config')
  .description('Show configuration requirements and current setup')
  .action(() => {
    console.log('Configuration using environment variables:\n');
    
    const domain = process.env.CANVAS_DOMAIN;
    const token = process.env.CANVAS_API_TOKEN;
    
    console.log('Required environment variables:');
    console.log(`  CANVAS_DOMAIN: ${domain ? '✓ Set (' + domain + ')' : '✗ Not set'}`);
    console.log(`  CANVAS_API_TOKEN: ${token ? '✓ Set (' + token.substring(0, 10) + '...)' : '✗ Not set'}`);
    
    if (!domain || !token) {
      console.log('\nTo configure:');
      console.log('1. Create a .env file in the project root');
      console.log('2. Add the following lines:');
      console.log('   CANVAS_DOMAIN=your-canvas-domain.instructure.com');
      console.log('   CANVAS_API_TOKEN=your-api-token');
      console.log('\nTo get your API token:');
      console.log('1. Log into your Canvas instance');
      console.log('2. Go to Account → Settings');
      console.log('3. Scroll down to "Approved Integrations"');
      console.log('4. Click "+ New Access Token"');
      console.log('5. Copy the generated token');
    } else {
      console.log('\n✅ Configuration looks good!');
    }    console.log('\nExample usage:');
    console.log('  canvas list              # List starred courses (default)');
    console.log('  canvas list -a           # List all enrolled courses');
    console.log('  canvas list -v           # List starred courses with details');
    console.log('  canvas list -a -v        # List all courses with details');
    console.log('  canvas submit            # Interactive assignment submission (single/multiple files)');
    console.log('  canvas profile           # Show user profile');
    console.log('  canvas assignments 12345 # Show assignments for course');
    console.log('  canvas grades            # Show grades for all courses');
    console.log('  canvas announcements     # Show recent announcements');
    console.log('  canvas get users/self    # Get current user info (raw API)');
    console.log('  canvas get courses       # Get courses (raw API)');
  });

// Add assignments command to show assignments for a course
program
  .command('assignments')
  .alias('assign')
  .description('List assignments for a specific course')
  .argument('<course-id>', 'Course ID to get assignments from')
  .option('-v, --verbose', 'Show detailed assignment information')
  .option('-s, --submitted', 'Only show submitted assignments')
  .option('-p, --pending', 'Only show pending assignments')
  .action(async (courseId, options) => {
    try {
      const queryParams = ['include[]=submission', 'include[]=score_statistics', 'per_page=100'];
      
      const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, queryParams);
      
      if (!assignments || assignments.length === 0) {
        console.log('No assignments found for this course.');
        return;
      }
        // Filter assignments based on options
      let filteredAssignments = assignments;
      if (options.submitted) {
        filteredAssignments = assignments.filter(a => a.submission && a.submission.submitted_at);
      } else if (options.pending) {
        filteredAssignments = assignments.filter(a => !a.submission || !a.submission.submitted_at);
      }
      
      console.log(`Found ${filteredAssignments.length} assignment(s):\n`);
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
        console.log(`   ID: ${assignment.id}`);
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
  });

// Add grades command to show grades
program
  .command('grades')
  .alias('grade')
  .description('Show grades for all courses or a specific course')
  .argument('[course-id]', 'Optional course ID to get grades for specific course')
  .option('-v, --verbose', 'Show detailed grade information')
  .action(async (courseId, options) => {
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
  });

// Add announcements command
program
  .command('announcements')
  .alias('announce')
  .description('Show recent announcements')
  .argument('[course-id]', 'Optional course ID to get announcements for specific course')
  .option('-l, --limit <number>', 'Number of announcements to show', '5')
  .action(async (courseId, options) => {
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
  });

// Add profile command
program
  .command('profile')
  .alias('me')
  .description('Show current user profile information')
  .option('-v, --verbose', 'Show detailed profile information')
  .action(async (options) => {
    try {
      const user = await makeCanvasRequest('get', 'users/self', ['include[]=email', 'include[]=locale']);
      
      console.log('User Profile:\n');
      console.log(`Name: ${user.name}`);
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`Login ID: ${user.login_id || 'N/A'}`);
      
      if (options.verbose) {
        console.log(`Short Name: ${user.short_name || 'N/A'}`);
        console.log(`Sortable Name: ${user.sortable_name || 'N/A'}`);
        console.log(`Locale: ${user.locale || 'N/A'}`);
        console.log(`Time Zone: ${user.time_zone || 'N/A'}`);
        console.log(`Avatar URL: ${user.avatar_url || 'N/A'}`);
        console.log(`Created: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}`);
      }
      
    } catch (error) {
      console.error('Error fetching profile:', error.message);
      process.exit(1);
    }
  });

// Add readline for interactive prompts
const readline = require('readline');

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Upload single file to Canvas and return the file ID
 */
async function uploadSingleFileToCanvas(courseId, assignmentId, filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = require('path').basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    // Step 1: Get upload URL from Canvas
    const uploadParams = [
      `name=${encodeURIComponent(fileName)}`,
      `size=${fileContent.length}`,
      'parent_folder_path=/assignments'
    ];
    
    const uploadData = await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`, uploadParams);
    
    if (!uploadData.upload_url) {
      throw new Error('Failed to get upload URL from Canvas');
    }

    // Step 2: Upload file to the provided URL
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add all the required fields from Canvas response
    Object.keys(uploadData.upload_params).forEach(key => {
      form.append(key, uploadData.upload_params[key]);
    });
    
    // Add the file
    form.append('file', fileContent, fileName);

    const uploadResponse = await axios.post(uploadData.upload_url, form, {
      headers: form.getHeaders(),
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    // Return the file ID for later submission
    return uploadData.id || uploadResponse.data.id;
    
  } catch (error) {
    throw new Error(`Failed to upload file ${filePath}: ${error.message}`);
  }
}

/**
 * Upload file to Canvas
 */
async function uploadFileToCanvas(courseId, assignmentId, filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = require('path').basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    // Step 1: Get upload URL from Canvas
    const uploadParams = [
      `name=${encodeURIComponent(fileName)}`,
      `size=${fileContent.length}`,
      'parent_folder_path=/assignments'
    ];
    
    const uploadData = await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`, uploadParams);
    
    if (!uploadData.upload_url) {
      throw new Error('Failed to get upload URL from Canvas');
    }

    // Step 2: Upload file to the provided URL
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add all the required fields from Canvas response
    Object.keys(uploadData.upload_params).forEach(key => {
      form.append(key, uploadData.upload_params[key]);
    });
    
    // Add the file
    form.append('file', fileContent, fileName);

    const uploadResponse = await axios.post(uploadData.upload_url, form, {
      headers: form.getHeaders(),
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    // Step 3: Submit the assignment with the file
    const submissionData = {
      submission: {
        submission_type: 'online_upload',
        file_ids: [uploadData.id || uploadResponse.data.id]
      }
    };

    const submission = await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions`, [], JSON.stringify(submissionData));
    
    return submission;
    
  } catch (error) {
    throw new Error(`Failed to upload file: ${error.message}`);  }
}

// Add submit command for interactive assignment submission
program  .command('submit')
  .alias('sub')
  .description('Interactively submit one or multiple files to an assignment')
  .option('-c, --course <course-id>', 'Skip course selection and use specific course ID')
  .option('-a, --assignment <assignment-id>', 'Skip assignment selection and use specific assignment ID')
  .option('-f, --file <file-path>', 'Skip file selection and use specific file path')
  .action(async (options) => {
    const rl = createReadlineInterface();
    
    try {
      let courseId = options.course;
      let assignmentId = options.assignment;
      let filePath = options.file;
      
      // Step 1: Select Course (if not provided)
      if (!courseId) {
        console.log('📚 Loading your starred courses...\n');
        
        const courses = await makeCanvasRequest('get', 'courses', [
          'enrollment_state=active',
          'include[]=favorites'
        ]);
        
        if (!courses || courses.length === 0) {
          console.log('No courses found.');
          rl.close();
          return;
        }
        
        // Filter for starred courses by default
        let starredCourses = courses.filter(course => course.is_favorite);
        
        if (starredCourses.length === 0) {
          console.log('No starred courses found. Showing all enrolled courses...\n');
          starredCourses = courses;
        }
        
        console.log('Select a course:');
        starredCourses.forEach((course, index) => {
          const starIcon = course.is_favorite ? '⭐ ' : '';
          console.log(`${index + 1}. ${starIcon}${course.name} (ID: ${course.id})`);
        });
        
        const courseChoice = await askQuestion(rl, '\nEnter course number: ');
        const courseIndex = parseInt(courseChoice) - 1;
        
        if (courseIndex < 0 || courseIndex >= starredCourses.length) {
          console.log('Invalid course selection.');
          rl.close();
          return;
        }
        
        courseId = starredCourses[courseIndex].id;
        console.log(`Selected: ${starredCourses[courseIndex].name}\n`);
      }
      
      // Step 2: Select Assignment (if not provided)
      if (!assignmentId) {
        console.log('📝 Loading assignments...\n');
          const assignments = await makeCanvasRequest('get', `courses/${courseId}/assignments`, [
          'include[]=submission',
          'order_by=due_at',
          'per_page=100'
        ]);
          if (!assignments || assignments.length === 0) {
          console.log('No assignments found for this course.');
          rl.close();
          return;
        }
          console.log(`Found ${assignments.length} assignment(s):\n`);
        
        // Show summary of assignment statuses
        const submittedCount = assignments.filter(a => a.submission && a.submission.submitted_at).length;
        const pendingCount = assignments.length - submittedCount;
        const uploadableCount = assignments.filter(a => 
          a.submission_types && 
          a.submission_types.includes('online_upload') && 
          a.workflow_state === 'published'
        ).length;
        
        console.log(`📊 Summary: ${submittedCount} submitted, ${pendingCount} pending, ${uploadableCount} accept file uploads\n`);
        console.log('Select an assignment:');
        assignments.forEach((assignment, index) => {
          const dueDate = assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : 'No due date';
          const submitted = assignment.submission && assignment.submission.submitted_at ? '✅' : '❌';
          
          // Check if assignment accepts file uploads
          const canSubmitFiles = assignment.submission_types && 
                                assignment.submission_types.includes('online_upload') &&
                                assignment.workflow_state === 'published';
          const submissionIcon = canSubmitFiles ? '📤' : '📋';
          
          // Format grade like Canvas web interface (same as assignments command)
          let gradeDisplay = '';
          const submission = assignment.submission;
          
          if (submission && submission.score !== null && submission.score !== undefined) {
            // Format score to remove unnecessary decimals (e.g., 3.0 becomes 3)
            const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
            const total = assignment.points_possible || 0;
            gradeDisplay = ` | Grade: ${score}/${total}`;
          } else if (submission && submission.excused) {
            gradeDisplay = ' | Grade: Excused';
          } else if (submission && submission.missing) {
            gradeDisplay = ' | Grade: Missing';
          } else if (assignment.points_possible) {
            gradeDisplay = ` | Grade: –/${assignment.points_possible}`;
          }
          
          console.log(`${index + 1}. ${submissionIcon} ${assignment.name} ${submitted}`);
          console.log(`   Due: ${dueDate} | Points: ${assignment.points_possible || 'N/A'}${gradeDisplay}`);
          if (!canSubmitFiles) {
            console.log(`   📋 Note: This assignment doesn't accept file uploads`);
          }
        });
          const assignmentChoice = await askQuestion(rl, '\nEnter assignment number: ');
        const assignmentIndex = parseInt(assignmentChoice) - 1;
        
        if (assignmentIndex < 0 || assignmentIndex >= assignments.length) {
          console.log('Invalid assignment selection.');
          rl.close();
          return;
        }
        
        const selectedAssignment = assignments[assignmentIndex];
        
        // Check if assignment accepts file uploads
        if (!selectedAssignment.submission_types || 
            !selectedAssignment.submission_types.includes('online_upload') ||
            selectedAssignment.workflow_state !== 'published') {
          console.log('❌ This assignment does not accept file uploads or is not published.');
          rl.close();
          return;
        }
        
        assignmentId = selectedAssignment.id;
        console.log(`Selected: ${selectedAssignment.name}\n`);
        
        // Check if already submitted
        if (selectedAssignment.submission && selectedAssignment.submission.submitted_at) {
          const resubmit = await askQuestion(rl, 'This assignment has already been submitted. Do you want to resubmit? (y/N): ');
          if (resubmit.toLowerCase() !== 'y' && resubmit.toLowerCase() !== 'yes') {
            console.log('Submission cancelled.');
            rl.close();
            return;
          }
        }
      }
        // Step 3: Select Files (if not provided)
      let filePaths = [];
      if (filePath) {
        filePaths = [filePath]; // Single file provided via option
      } else {
        console.log('📁 File selection options:');
        console.log('1. Enter file path(s) manually');
        console.log('2. Select from current directory');
        
        const fileChoice = await askQuestion(rl, '\nChoose option (1-2): ');
        
        if (fileChoice === '1') {
          const singleOrMultiple = await askQuestion(rl, 'Submit single file or multiple files? (s/m): ');
          
          if (singleOrMultiple.toLowerCase() === 'm' || singleOrMultiple.toLowerCase() === 'multiple') {
            console.log('Enter file paths (one per line). Press Enter on empty line to finish:');
            let fileInput = '';
            while (true) {
              fileInput = await askQuestion(rl, 'File path: ');
              if (fileInput === '') break;
              filePaths.push(fileInput);
            }
          } else {
            const singleFile = await askQuestion(rl, 'Enter file path: ');
            filePaths = [singleFile];
          }
        } else if (fileChoice === '2') {
          try {
            const files = fs.readdirSync('.').filter(file => 
              fs.statSync(file).isFile() && 
              !file.startsWith('.') &&
              file !== 'package.json' &&
              file !== 'README.md'
            );
            
            if (files.length === 0) {
              console.log('No suitable files found in current directory.');
              const manualFile = await askQuestion(rl, 'Enter file path manually: ');
              filePaths = [manualFile];
            } else {
              console.log('\nFiles in current directory:');
              files.forEach((file, index) => {
                const stats = fs.statSync(file);
                const size = (stats.size / 1024).toFixed(1) + ' KB';
                console.log(`${index + 1}. ${file} (${size})`);
              });
              
              const multipleFiles = await askQuestion(rl, '\nSelect multiple files? (y/N): ');
              
              if (multipleFiles.toLowerCase() === 'y' || multipleFiles.toLowerCase() === 'yes') {
                console.log('Enter file numbers separated by commas (e.g., 1,3,5) or ranges (e.g., 1-3):');
                const fileIndices = await askQuestion(rl, 'File numbers: ');
                
                const selectedIndices = [];
                const parts = fileIndices.split(',');
                
                for (const part of parts) {
                  const trimmed = part.trim();
                  if (trimmed.includes('-')) {
                    // Handle range (e.g., 1-3)
                    const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                    for (let i = start; i <= end; i++) {
                      selectedIndices.push(i - 1); // Convert to 0-based index
                    }
                  } else {
                    // Handle single number
                    selectedIndices.push(parseInt(trimmed) - 1); // Convert to 0-based index
                  }
                }
                
                // Remove duplicates and filter valid indices
                const uniqueIndices = [...new Set(selectedIndices)].filter(
                  index => index >= 0 && index < files.length
                );
                
                if (uniqueIndices.length === 0) {
                  console.log('No valid file selections.');
                  const manualFile = await askQuestion(rl, 'Enter file path manually: ');
                  filePaths = [manualFile];
                } else {
                  filePaths = uniqueIndices.map(index => files[index]);
                }
              } else {
                // Single file selection
                const fileIndex = await askQuestion(rl, '\nEnter file number: ');
                const selectedFileIndex = parseInt(fileIndex) - 1;
                
                if (selectedFileIndex >= 0 && selectedFileIndex < files.length) {
                  filePaths = [files[selectedFileIndex]];
                } else {
                  console.log('Invalid file selection.');
                  const manualFile = await askQuestion(rl, 'Enter file path manually: ');
                  filePaths = [manualFile];
                }
              }
            }
          } catch (error) {
            console.log('Error reading directory.');
            const manualFile = await askQuestion(rl, 'Enter file path manually: ');
            filePaths = [manualFile];
          }
        } else {
          console.log('Invalid option.');
          rl.close();
          return;
        }
      }
      
      // Validate all selected files exist
      const validFiles = [];
      for (const file of filePaths) {
        if (fs.existsSync(file)) {
          validFiles.push(file);
        } else {
          console.log(`⚠️  File not found: ${file}`);
        }
      }
      
      if (validFiles.length === 0) {
        console.log('No valid files selected.');
        rl.close();
        return;
      }
      
      filePaths = validFiles;
        // Step 4: Confirm and Submit
      console.log('\n📋 Submission Summary:');
      console.log(`Course ID: ${courseId}`);
      console.log(`Assignment ID: ${assignmentId}`);
      console.log(`Files (${filePaths.length}):`);
      filePaths.forEach((file, index) => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(`  ${index + 1}. ${file} (${size})`);
      });
      
      const confirm = await askQuestion(rl, '\nProceed with submission? (Y/n): ');
      if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
        console.log('Submission cancelled.');
        rl.close();
        return;
      }
      
      console.log('\n🚀 Uploading files...');
      
      // Upload all files
      const uploadedFileIds = [];
      for (let i = 0; i < filePaths.length; i++) {
        const currentFile = filePaths[i];
        console.log(`📤 Uploading ${i + 1}/${filePaths.length}: ${require('path').basename(currentFile)}`);
        
        try {
          const fileId = await uploadSingleFileToCanvas(courseId, assignmentId, currentFile);
          uploadedFileIds.push(fileId);
          console.log(`✅ ${require('path').basename(currentFile)} uploaded successfully`);
        } catch (error) {
          console.error(`❌ Failed to upload ${currentFile}: ${error.message}`);
          const continueUpload = await askQuestion(rl, 'Continue with remaining files? (Y/n): ');
          if (continueUpload.toLowerCase() === 'n' || continueUpload.toLowerCase() === 'no') {
            break;
          }
        }
      }
      
      if (uploadedFileIds.length === 0) {
        console.log('❌ No files were uploaded successfully.');
        rl.close();
        return;
      }
      
      // Submit the assignment with all uploaded files
      console.log('\n📝 Submitting assignment...');
      const submissionData = {
        submission: {
          submission_type: 'online_upload',
          file_ids: uploadedFileIds
        }
      };

      const submission = await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions`, [], JSON.stringify(submissionData));
      
      console.log(`✅ Assignment submitted successfully with ${uploadedFileIds.length} file(s)!`);
      console.log(`Submission ID: ${submission.id}`);
      console.log(`Submitted at: ${new Date(submission.submitted_at).toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ Submission failed:', error.message);
    } finally {
      rl.close();
    }
  });

// Parse command line arguments
program.parse();
