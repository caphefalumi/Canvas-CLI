#!/usr/bin/env node
/**
 * Canvas CLI - A command line tool for interacting with Canvas API
 *
 * @author caphefalumi
 * @version 1.7.0
 */

import { Command } from "commander";
import { listCourses } from "../commands/list.js";
import {
  showConfig,
  setupConfig,
  editConfig,
  showConfigPath,
  deleteConfigFile,
} from "../commands/config.js";
import { listAssignments } from "../commands/assignments.js";
import { showGrades } from "../commands/grades.js";
import { showAnnouncements } from "../commands/announcements.js";
import { showProfile } from "../commands/profile.js";
import { submitAssignment } from "../commands/submit.js";
import { showCalendar } from "../commands/calendar.js";
import { showModules } from "../commands/modules.js";
import { showTodo } from "../commands/todo.js";
import { showFiles } from "../commands/files.js";
import { showGroups } from "../commands/groups.js";
import { requireConfig } from "../lib/config-validator.js";

const program = new Command();

// Setup CLI program
program
  .name("canvas")
  .description("Canvas LMS Command Line Interface")
  .version("1.7.0", "-v, --version", "Output the current version");

// List command to show enrolled courses
program
  .command("list")
  .alias("courses")
  .alias("course")
  .alias("subject")
  .alias("subjects")
  .description("List starred courses (use -a for all)")
  .option("-a, --all", "Show all enrolled courses")
  .option("-v, --verbose", "Show detailed info")
  .action(requireConfig(listCourses));

// Config command with subcommands
const configCommand = program
  .command("config")
  .description("Manage CLI configuration")
  .action(showConfig);

configCommand
  .command("show")
  .alias("status")
  .description("Show current config")
  .action(showConfig);

configCommand
  .command("setup")
  .alias("init")
  .description("Interactive setup wizard")
  .action(setupConfig);

configCommand
  .command("edit")
  .alias("update")
  .description("Edit existing config")
  .action(editConfig);

configCommand
  .command("path")
  .description("Show config file path")
  .action(showConfigPath);

configCommand
  .command("delete")
  .alias("remove")
  .description("Delete config file")
  .action(deleteConfigFile);

// Assignments command to show assignments for a course
program
  .command("assignments")
  .alias("assign")
  .description("List assignments for a course")
  .argument("[course-name]", "Course name (optional)")
  .option("-v, --verbose", "Show detailed info")
  .option("-s, --submitted", "Show submitted only")
  .option("-p, --pending", "Show pending only")
  .action(requireConfig(listAssignments));

// Grades command to show grades
program
  .command("grades")
  .alias("grade")
  .alias("mark")
  .alias("marks")
  .description("View grades (interactive or by course name)")
  .argument("[course-name]", "Course name for detailed view (optional)")
  .option("-v, --verbose", "Show extra details")
  .option("-a, --all", "Include inactive courses")
  .action(requireConfig(showGrades));

// Announcements command
program
  .command("announcements")
  .alias("an")
  .description("View course announcements")
  .argument("[course-name]", "Course name (optional)")
  .option("-l, --limit <number>", "Number to show", "5")
  .action(requireConfig(showAnnouncements));

// Profile command
program
  .command("profile")
  .alias("me")
  .description("Show your Canvas profile")
  .option("-v, --verbose", "Show all fields")
  .action(requireConfig(showProfile));

// Submit command for interactive assignment submission
program
  .command("submit")
  .alias("sub")
  .description("Submit files to an assignment")
  .argument("[course-name]", "Course name (optional)")
  .option("-f, --file <file-path>", "Specify file path")
  .option("-a, --all", "Show all courses", false)
  .option("--dry-run", "Test submission", false)
  .action(requireConfig(submitAssignment));

// Calendar command to show upcoming due dates
program
  .command("calendar")
  .alias("cal")
  .alias("due")
  .description("View upcoming due dates across courses")
  .option("-d, --days <number>", "Days to look ahead", "14")
  .option("-a, --all", "Include all courses", false)
  .option("-p, --past", "Include past due (last 7 days)", false)
  .action(requireConfig(showCalendar));

// Modules command to browse course content
program
  .command("modules")
  .alias("mod")
  .alias("content")
  .description("Browse course modules and content")
  .argument("[course-name]", "Course name (optional)")
  .option("-a, --all", "Show all courses", false)
  .action(requireConfig(showModules));

// Todo command to view all pending items
program
  .command("todo")
  .alias("tasks")
  .alias("pending")
  .description("View all pending todo items across courses")
  .option("-l, --limit <number>", "Number of items to show", "20")
  .action(requireConfig(showTodo));

// Files command to browse and download course files
program
  .command("files")
  .alias("file")
  .alias("docs")
  .description("Browse and download course files")
  .argument("[course-name]", "Course name (optional)")
  .option("-a, --all", "Show all courses", false)
  .action(requireConfig(showFiles));

// Groups command to view group memberships
program
  .command("groups")
  .alias("group")
  .alias("teams")
  .alias("team")
  .description("View your Canvas group memberships")
  .option("-v, --verbose", "Show detailed info")
  .option("-m, --members", "Show group members")
  .action(requireConfig(showGroups));

// Parse command line arguments
program.parse();
