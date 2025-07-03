#!/usr/bin/env node

/**
 * Canvas CLI - A command line tool for interacting with Canvas API
 * 
 * @author Canvas CLI Team
 * @version 1.0.0
 */

const { Command } = require('commander');

// Import command handlers
const { listCourses } = require('../commands/list');
const { showConfig } = require('../commands/config');
const { listAssignments } = require('../commands/assignments');
const { showGrades } = require('../commands/grades');
const { showAnnouncements } = require('../commands/announcements');
const { showProfile } = require('../commands/profile');
const { submitAssignment } = require('../commands/submit');
const { createQueryHandler } = require('../commands/api');

const program = new Command();

// Setup CLI program
program
  .name('canvas')
  .description('Canvas API Command Line Tool')
  .version('1.0.0');

// Raw API commands
function createQueryCommand(method) {
  return program
    .command(method)
    .alias(method === 'query' ? 'q' : method.charAt(0))
    .argument('<endpoint>', 'Canvas API endpoint to query')
    .option('-q, --query <param>', 'Query parameter (can be used multiple times)', [])
    .option('-d, --data <data>', 'Request body (JSON string or @filename)')
    .description(`${method.toUpperCase()} request to Canvas API`)
    .action(createQueryHandler(method));
}

// Create raw API commands
createQueryCommand('get');
createQueryCommand('post');
createQueryCommand('put');
createQueryCommand('delete');
createQueryCommand('query');

// List command to show enrolled courses
program
  .command('list')
  .alias('l')
  .description('List starred courses (default) or all courses with -a')
  .option('-a, --all', 'Show all enrolled courses instead of just starred ones')
  .option('-v, --verbose', 'Show detailed course information')
  .action(listCourses);

// Config command to help users set up their configuration
program
  .command('config')
  .description('Show configuration requirements and current setup')
  .action(showConfig);

// Assignments command to show assignments for a course
program
  .command('assignments')
  .alias('assign')
  .description('List assignments for a specific course')
  .argument('<course-id>', 'Course ID to get assignments from')
  .option('-v, --verbose', 'Show detailed assignment information')
  .option('-s, --submitted', 'Only show submitted assignments')
  .option('-p, --pending', 'Only show pending assignments')
  .action(listAssignments);

// Grades command to show grades
program
  .command('grades')
  .alias('grade')
  .description('Show grades for all courses or a specific course')
  .argument('[course-id]', 'Optional course ID to get grades for specific course')
  .option('-v, --verbose', 'Show detailed grade information')
  .action(showGrades);

// Announcements command
program
  .command('announcements')
  .alias('announce')
  .description('Show recent announcements')
  .argument('[course-id]', 'Optional course ID to get announcements for specific course')
  .option('-l, --limit <number>', 'Number of announcements to show', '5')
  .action(showAnnouncements);

// Profile command
program
  .command('profile')
  .alias('me')
  .description('Show current user profile information')
  .option('-v, --verbose', 'Show detailed profile information')
  .action(showProfile);

// Submit command for interactive assignment submission
program
  .command('submit')
  .alias('sub')
  .description('Interactively submit one or multiple files to an assignment')
  .option('-c, --course <course-id>', 'Skip course selection and use specific course ID')
  .option('-a, --assignment <assignment-id>', 'Skip assignment selection and use specific assignment ID')
  .option('-f, --file <file-path>', 'Skip file selection and use specific file path')
  .action(submitAssignment);

// Parse command line arguments
program.parse();
