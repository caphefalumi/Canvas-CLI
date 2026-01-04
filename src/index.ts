#!/usr/bin/env node
/**
 * Canvas CLI - A command line tool for interacting with Canvas API
 *
 * @author caphefalumi
 * @version 1.9.1
 */

import { Command } from "commander";
import { listCourses } from "../commands/list.js";
import {
  showConfig,
  setupConfig,
  editConfig,
  showConfigPath,
  deleteConfigFile,
  setConfigValue,
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
import { starCourse, unstarCourse } from "../commands/star.js";
import { calculateOverallGPA, calculateWhatIfGrade } from "../commands/gpa.js";
import { bulkDownload } from "../commands/download.js";
import { requireConfig } from "../lib/config-validator.js";

const program = new Command();

// Setup CLI program
program
  .name("canvas")
  .description("Canvas LMS Command Line Interface")
  .version("1.9.3", "-V, --version", "Output the current version");

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

configCommand
  .command("set <key> <value>")
  .description("Set a configuration value (domain, token, truncate)")
  .action(setConfigValue);

program
  .command("login")
  .alias("signin")
  .description("Interactive setup wizard")
  .action(setupConfig);

// Assignments command to show assignments for a course
program
  .command("assignments")
  .alias("assign")
  .description("List assignments for a course")
  .argument("[course-name]", "Course name (optional)")
  .option("-v, --verbose", "Show detailed info")
  .option("-s, --submitted", "Show submitted only")
  .option("-p, --pending", "Show pending only")
  .option("-a, --all-courses", "Show assignments from all courses")
  .option("-m, --missing", "Show missing assignments only")
  .option("-w, --due-this-week", "Show assignments due this week")
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
  .option("-v, --verbose", "Show detailed info")
  .option("-a, --all", "Show announcements from all courses")
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
  .option("-v, --verbose", "Show detailed info")
  .action(requireConfig(showCalendar));

// Modules command to browse course content
program
  .command("modules")
  .alias("mod")
  .alias("content")
  .description("Browse course modules and content")
  .argument("[course-name]", "Course name (optional)")
  .option("-a, --all", "Show all courses", false)
  .option("-v, --verbose", "Show detailed info")
  .action(requireConfig(showModules));

// Todo command to view all pending items
program
  .command("todo")
  .alias("tasks")
  .alias("pending")
  .description("View all pending todo items across courses")
  .option("-l, --limit <number>", "Number of items to show", "20")
  .option("-v, --verbose", "Show detailed info")
  .action(requireConfig(showTodo));

// Files command to browse and download course files
program
  .command("files")
  .alias("file")
  .alias("docs")
  .description("Browse and download course files")
  .argument("[course-name]", "Course name (optional)")
  .option("-a, --all", "Show all courses", false)
  .option("-v, --verbose", "Show detailed info")
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

// Star command to add course to favorites
program
  .command("star [course-name]")
  .alias("favourite")
  .alias("favorite")
  .description("Star a course (add to favorites)")
  .action(requireConfig(starCourse));

// Unstar command to remove course from favorites
program
  .command("unstar [course-name]")
  .alias("unfavourite")
  .alias("unfavorite")
  .description("Unstar a course (remove from favorites)")
  .action(requireConfig(unstarCourse));

// GPA Calculator command
program
  .command("gpa")
  .alias("grade-calculator")
  .description("Calculate overall GPA across all courses (4.0 scale)")
  .option("-p, --include-past", "Include completed courses")
  .action(requireConfig(calculateOverallGPA));

// What-if grade calculator
program
  .command("what-if")
  .alias("grade-calc")
  .alias("need")
  .description("Calculate what grade you need on remaining work")
  .action(requireConfig(calculateWhatIfGrade));

// Bulk download command
program
  .command("download [course-name]")
  .alias("dl")
  .alias("bulk-download")
  .description("Download all files from a course")
  .option("-a, --all", "Show all courses", false)
  .option("-o, --output <path>", "Output directory")
  .action(requireConfig(bulkDownload));

// Parse command line arguments
program.parseAsync();
