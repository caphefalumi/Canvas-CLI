/**
 * Assignments command
 */

import { makeCanvasRequest, getCanvasCourse } from "../lib/api-client.js";
import { createReadlineInterface } from "../lib/interactive.js";
import {
  pickCourse,
  displayAssignments,
  printInfo,
  printError,
  printSuccess,
  printSeparator,
  Table,
} from "../lib/display.js";
import chalk from "chalk";
import type {
  CanvasCourse,
  CanvasAssignment,
  ListAssignmentsOptions,
} from "../types/index.js";

interface AssignmentWithCourse extends CanvasAssignment {
  courseName?: string;
  courseCode?: string;
}

/**
 * List assignments from all courses with filtering
 */
async function listAllCoursesAssignments(
  options: ListAssignmentsOptions = {},
): Promise<void> {
  try {
    printSeparator("=");
    printInfo("Loading assignments from all courses...");
    printSeparator("=");

    // Fetch all active courses
    const queryParams: string[] = [
      "enrollment_state=active",
      "include[]=term",
      "per_page=100",
    ];

    const courses = await makeCanvasRequest<CanvasCourse[]>(
      "get",
      "courses",
      queryParams,
    );

    if (!courses || courses.length === 0) {
      printError("No courses found.");
      return;
    }

    console.log(chalk.cyan(`Found ${courses.length} active course(s)\n`));

    // Fetch assignments from each course
    const allAssignments: AssignmentWithCourse[] = [];

    for (const course of courses) {
      try {
        const assignmentParams = ["include[]=submission", "per_page=100"];
        const assignments = await makeCanvasRequest<CanvasAssignment[]>(
          "get",
          `courses/${course.id}/assignments`,
          assignmentParams,
        );

        if (assignments && assignments.length > 0) {
          for (const assignment of assignments) {
            allAssignments.push({
              ...assignment,
              courseName: course.name,
              courseCode: course.course_code,
            });
          }
        }
      } catch {
        // Skip courses with errors
        continue;
      }
    }

    if (allAssignments.length === 0) {
      printError("No assignments found in any course.");
      return;
    }

    // Apply filters
    let filteredAssignments = allAssignments;

    // Filter by missing (not submitted and has due date)
    if (options.missing) {
      filteredAssignments = filteredAssignments.filter((a) => {
        const submission = (a as any).submission;
        const isNotSubmitted = !submission || !submission.submitted_at;
        const hasDueDate = a.due_at !== null;
        return isNotSubmitted && hasDueDate;
      });
    }

    // Filter by submitted
    if (options.submitted) {
      filteredAssignments = filteredAssignments.filter(
        (a) => (a as any).submission && (a as any).submission.submitted_at,
      );
    }

    // Filter by pending
    if (options.pending) {
      filteredAssignments = filteredAssignments.filter(
        (a) => !(a as any).submission || !(a as any).submission.submitted_at,
      );
    }

    // Filter by due this week
    if (options.dueThisWeek) {
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      filteredAssignments = filteredAssignments.filter((a) => {
        if (!a.due_at) return false;
        const dueDate = new Date(a.due_at);
        return dueDate >= now && dueDate <= oneWeekFromNow;
      });
    }

    // Sort by due date
    filteredAssignments.sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    });

    printSuccess(
      `Found ${filteredAssignments.length} assignment(s) matching criteria.\n`,
    );

    // Display assignments in a table
    const table = new Table(
      [
        { key: "course", header: "Course", flex: 1.5, minWidth: 15 },
        { key: "assignment", header: "Assignment", flex: 2.5, minWidth: 25 },
        {
          key: "due",
          header: "Due Date",
          flex: 1.2,
          minWidth: 12,
          color: (val) => {
            if (val === "No due date") return chalk.gray(val);
            const dueDate = new Date(val);
            const now = new Date();
            const daysUntilDue = Math.ceil(
              (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            );

            if (daysUntilDue < 0) return chalk.red(val);
            if (daysUntilDue <= 2) return chalk.red.bold(val);
            if (daysUntilDue <= 7) return chalk.yellow(val);
            return chalk.green(val);
          },
        },
        {
          key: "status",
          header: "Status",
          flex: 1,
          minWidth: 10,
          color: (val) => {
            if (val.includes("✓")) return chalk.green(val);
            if (val.includes("✗")) return chalk.red(val);
            return chalk.yellow(val);
          },
        },
        { key: "points", header: "Points", flex: 0.8, minWidth: 8 },
      ],
      { showRowNumbers: true, title: undefined },
    );

    for (const assignment of filteredAssignments) {
      const submission = (assignment as any).submission;
      const isSubmitted = submission && submission.submitted_at;

      let statusText = "";
      if (isSubmitted) {
        const hasGrade =
          submission.score !== null && submission.score !== undefined;
        statusText = hasGrade
          ? `✓ Graded (${submission.score})`
          : "✓ Submitted";
      } else {
        const dueDate = assignment.due_at ? new Date(assignment.due_at) : null;
        const isPastDue = dueDate && dueDate < new Date();
        statusText = isPastDue ? "✗ Missing" : "○ Pending";
      }

      table.addRow({
        course:
          assignment.courseCode ||
          assignment.courseName?.substring(0, 15) ||
          "Unknown",
        assignment: assignment.name,
        due: assignment.due_at
          ? new Date(assignment.due_at).toLocaleDateString()
          : "No due date",
        status: statusText,
        points: assignment.points_possible?.toString() || "N/A",
      });
    }

    table.render();
    printSeparator("=");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printError(`Error fetching assignments: ${errorMessage}`);
  }
}

export async function listAssignments(
  courseName?: string,
  options: ListAssignmentsOptions = {},
): Promise<void> {
  try {
    // If --all-courses flag is set, fetch assignments from all courses
    if (options.allCourses) {
      return await listAllCoursesAssignments(options);
    }

    let course: CanvasCourse | undefined;
    let selectedCourseId: string;

    if (!courseName) {
      const result = await pickCourse({
        title: "\nLoading your courses, please wait...",
      });
      if (!result) return;

      course = result.course;
      selectedCourseId = course.id.toString();
      result.rl.close();
    } else {
      const rl = createReadlineInterface();
      course = await getCanvasCourse(courseName, rl);
      if (!course) {
        return;
      }
      selectedCourseId = course.id.toString();
    }

    printSeparator();

    const assignmentParams = ["include[]=submission", "per_page=100"];
    printInfo("Loading assignments, please wait...");

    const assignments = await makeCanvasRequest<CanvasAssignment[]>(
      "get",
      `courses/${selectedCourseId}/assignments`,
      assignmentParams,
    );

    if (!assignments || assignments.length === 0) {
      printError(
        `No assignments found for course: ${course?.name || selectedCourseId}`,
      );
      return;
    }

    let filteredAssignments = assignments;
    if (options.submitted) {
      filteredAssignments = assignments.filter(
        (a) => (a as any).submission && (a as any).submission.submitted_at,
      );
    } else if (options.pending) {
      filteredAssignments = assignments.filter(
        (a) => !(a as any).submission || !(a as any).submission.submitted_at,
      );
    }

    printInfo(`\nAssignments for: ${course?.name || selectedCourseId}`);
    printSuccess(`Found ${filteredAssignments.length} assignment(s).`);

    displayAssignments(filteredAssignments, {
      showId: true,
      showGrade: true,
      showDueDate: true,
      showStatus: options.verbose,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching assignments:"), errorMessage);
    process.exit(1);
  }
}
