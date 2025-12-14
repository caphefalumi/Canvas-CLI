/**
 * Canvas CLI - A command line tool for interacting with Canvas API
 *
 * @author caphefalumi
 * @version 1.6.2
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
import { requireConfig } from "../lib/config-validator.js";

const program = new Command();

// Setup CLI program
program
  .name("canvas")
  .description("Canvas LMS Command Line Interface")
  .version("1.6.2", "-v, --version", "Output the current version");

// List command to show enrolled courses
program
  .command("list")
  .alias("l")
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
  .argument("[course-id]", "Course ID (optional)")
  .option("-v, --verbose", "Show detailed info")
  .option("-s, --submitted", "Show submitted only")
  .option("-p, --pending", "Show pending only")
  .action(requireConfig(listAssignments));

// Grades command to show grades
program
  .command("grades")
  .alias("grade")
  .description("View grades (interactive or by course ID)")
  .argument("[course-id]", "Course ID for detailed view")
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

// Parse command line arguments
program.parse();
