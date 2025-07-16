#!/usr/bin/env node

/**
 * Canvas CLI - A command line tool for interacting with Canvas API
 * 
 * @author Canvas CLI Team
 * @version 1.0.0
 */

import { Command } from 'commander';
import { listCourses } from '../commands/list.js';
import { showConfig, setupConfig, editConfig, showConfigPath, deleteConfigFile } from '../commands/config.js';
import { listAssignments } from '../commands/assignments.js';
import { showGrades } from '../commands/grades.js';
import { showAnnouncements } from '../commands/announcements.js';
import { showProfile } from '../commands/profile.js';
import { submitAssignment } from '../commands/submit.js';
import { requireConfig } from '../lib/config-validator.js';

const program = new Command();

// Setup CLI program
program
  .name('canvas')
  .description('Canvas API Command Line Tool')
  .version('1.3.3');

// List command to show enrolled courses
program
  .command('list')
  .alias('l')
  .description('List starred courses (default) or all courses with -a')
  .option('-a, --all', 'Show all enrolled courses instead of just starred ones')
  .option('-v, --verbose', 'Show detailed course information')
  .action((...args) => requireConfig(listCourses)(...args));

// Config command with subcommands
const configCommand = program
  .command('config')
  .description('Manage Canvas CLI configuration')
  .action((...args) => showConfig(...args)); // Default action when no subcommand is provided

configCommand
  .command('show')
  .alias('status')
  .description('Show current configuration')
  .action((...args) => showConfig(...args));

configCommand
  .command('setup')
  .alias('init')
  .description('Interactive configuration setup')
  .action((...args) => setupConfig(...args));

configCommand
  .command('edit')
  .alias('update')
  .description('Edit existing configuration')
  .action((...args) => editConfig(...args));

configCommand
  .command('path')
  .description('Show configuration file path')
  .action((...args) => showConfigPath(...args));

configCommand
  .command('delete')
  .alias('remove')
  .description('Delete configuration file')
  .action((...args) => deleteConfigFile(...args));

// Assignments command to show assignments for a course
program
  .command('assignments')
  .alias('assign')
  .description('List assignments for a specific course')
  .argument('<course-id>', 'Course ID to get assignments from')
  .option('-v, --verbose', 'Show detailed assignment information')
  .option('-s, --submitted', 'Only show submitted assignments')
  .option('-p, --pending', 'Only show pending assignments')
  .action((...args) => requireConfig(listAssignments)(...args));

// Grades command to show grades
program
  .command('grades')
  .alias('grade')
  .description('Show grades for all courses or a specific course')
  .argument('[course-id]', 'Optional course ID to get grades for specific course')
  .option('-v, --verbose', 'Show detailed grade information')
  .action((...args) => requireConfig(showGrades)(...args));

// Announcements command
program
  .command('announcements')
  .alias('an')
  .description('Show recent announcements (interactive if no course-id)')
  .argument('[course-id]', 'Optional course ID to get announcements for specific course')
  .option('-l, --limit <number>', 'Number of announcements to show', '5')
  .action((...args) => requireConfig(showAnnouncements)(...args));

// Profile command
program
  .command('profile')
  .alias('me')
  .description('Show current user profile information')
  .option('-v, --verbose', 'Show detailed profile information')
  .action((...args) => requireConfig(showProfile)(...args));

// Submit command for interactive assignment submission (always list files in current directory)
program
  .command('submit')
  .alias('sub')
  .description('Interactively submit one or multiple files to an assignment')
  .option('-c, --course <course-id>', 'Skip course selection and use specific course ID')
  .option('-f, --file <file-path>', 'Skip file selection and use specific file path')
  .option('-a, --all', 'Show all enrolled courses instead of just starred ones')
  .action((...args) => requireConfig(submitAssignment)(...args));

// Parse command line arguments
program.parse();
