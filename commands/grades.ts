/**
 * Grades command
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  createReadlineInterface,
  askQuestionWithValidation,
} from "../lib/interactive.js";
import { pad } from "../lib/display.js";
import chalk from "chalk";
import type {
  CanvasCourse,
  CanvasEnrollment,
  CanvasAssignment,
  ShowGradesOptions,
} from "../types/index.js";

interface AssignmentGrade {
  name: string;
  id: number;
  score: number | null;
  pointsPossible: number;
  submitted: boolean;
  graded: boolean;
  dueAt: string | null;
}

/**
 * Show detailed grades for a specific course including assignment breakdown
 */
async function showDetailedGrades(
  courseId: string,
  options: ShowGradesOptions,
): Promise<void> {
  console.log(chalk.cyan.bold("\n" + "=".repeat(80)));
  console.log(chalk.cyan.bold("Loading course grades, please wait..."));

  const course = await makeCanvasRequest<CanvasCourse>(
    "get",
    `courses/${courseId}`,
  );

  const enrollmentParams = ["user_id=self", "include[]=total_scores"];
  // Always include all states to ensure we find the enrollment
  enrollmentParams.push("state[]=active");
  enrollmentParams.push("state[]=invited");
  enrollmentParams.push("state[]=creation_pending");
  enrollmentParams.push("state[]=rejected");
  enrollmentParams.push("state[]=completed");
  enrollmentParams.push("state[]=inactive");

  const enrollments = await makeCanvasRequest<CanvasEnrollment[]>(
    "get",
    `courses/${courseId}/enrollments`,
    enrollmentParams,
  );

  if (!enrollments || enrollments.length === 0) {
    console.log(chalk.red("Error: No enrollment found for this course."));
    return;
  }

  const enrollment = enrollments[0];
  const grades = enrollment?.grades;

  // Fetch assignments with submissions
  const assignments = await makeCanvasRequest<CanvasAssignment[]>(
    "get",
    `courses/${courseId}/assignments`,
    ["include[]=submission", "per_page=100"],
  );

  console.log(chalk.cyan.bold("\n" + "=".repeat(80)));
  console.log(chalk.cyan.bold(`Course: ${course.name}`));
  console.log(chalk.cyan("=".repeat(80)));

  // Process assignments
  const assignmentGrades: AssignmentGrade[] = assignments.map((assignment) => {
    const submission = (assignment as any).submission;
    return {
      name: assignment.name,
      id: assignment.id,
      score: submission?.score ?? null,
      pointsPossible: assignment.points_possible || 0,
      submitted: !!(submission && submission.submitted_at),
      graded: submission?.score !== null && submission?.score !== undefined,
      dueAt: assignment.due_at,
    };
  });

  // Calculate totals
  const gradedAssignments = assignmentGrades.filter((a) => a.graded);
  const totalPointsEarned = gradedAssignments.reduce(
    (sum, a) => sum + (a.score || 0),
    0,
  );
  const totalPointsPossible = gradedAssignments.reduce(
    (sum, a) => sum + a.pointsPossible,
    0,
  );
  const calculatedPercentage =
    totalPointsPossible > 0
      ? ((totalPointsEarned / totalPointsPossible) * 100).toFixed(2)
      : "N/A";

  // Display overall grades (merged table)
  console.log(chalk.white.bold("\nOverall Grades:"));

  // Calculate adaptive column widths based on terminal size
  const termWidth = process.stdout.columns || 80;
  const borderOverhead = 10; // │ + │ + │ + │ and spaces
  const availableWidth = Math.max(60, termWidth - borderOverhead);

  // Distribute width proportionally: Metric(35%), Score(40%), Status(25%)
  const colMetric = Math.max(18, Math.floor(availableWidth * 0.35));
  const colScore = Math.max(20, Math.floor(availableWidth * 0.4));
  const colStatus = Math.max(12, availableWidth - colMetric - colScore);

  // Top border (rounded)
  console.log(
    chalk.gray("╭─") +
      chalk.gray("─".repeat(colMetric)) +
      chalk.gray("┬─") +
      chalk.gray("─".repeat(colScore)) +
      chalk.gray("┬─") +
      chalk.gray("─".repeat(colStatus)) +
      chalk.gray("╮"),
  );

  // Header
  console.log(
    chalk.gray("│ ") +
      chalk.cyan.bold(pad("Metric", colMetric)) +
      chalk.gray("│ ") +
      chalk.cyan.bold(pad("Score/Grade", colScore)) +
      chalk.gray("│ ") +
      chalk.cyan.bold(pad("Status", colStatus)) +
      chalk.gray("│"),
  );

  // Header separator
  console.log(
    chalk.gray("├─") +
      chalk.gray("─".repeat(colMetric)) +
      chalk.gray("┼─") +
      chalk.gray("─".repeat(colScore)) +
      chalk.gray("┼─") +
      chalk.gray("─".repeat(colStatus)) +
      chalk.gray("┤"),
  );

  if (grades) {
    const currentScoreValue =
      grades.current_score !== null ? `${grades.current_score}%` : "N/A";
    const finalScoreValue =
      grades.final_score !== null ? `${grades.final_score}%` : "N/A";
    const currentGradeValue = grades.current_grade || "N/A";
    const finalGradeValue = grades.final_grade || "N/A";

    console.log(
      chalk.gray("│ ") +
        chalk.white(pad("Current Score", colMetric)) +
        chalk.gray("│ ") +
        chalk.green.bold(pad(currentScoreValue, colScore)) +
        chalk.gray("│ ") +
        chalk.gray(pad("Official", colStatus)) +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│ ") +
        chalk.white(pad("Final Score", colMetric)) +
        chalk.gray("│ ") +
        chalk.green.bold(pad(finalScoreValue, colScore)) +
        chalk.gray("│ ") +
        chalk.gray(pad("Official", colStatus)) +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│ ") +
        chalk.white(pad("Current Grade", colMetric)) +
        chalk.gray("│ ") +
        chalk.green.bold(pad(currentGradeValue, colScore)) +
        chalk.gray("│ ") +
        chalk.gray(pad("Letter Grade", colStatus)) +
        chalk.gray("│"),
    );
    console.log(
      chalk.gray("│ ") +
        chalk.white(pad("Final Grade", colMetric)) +
        chalk.gray("│ ") +
        chalk.green.bold(pad(finalGradeValue, colScore)) +
        chalk.gray("│ ") +
        chalk.gray(pad("Letter Grade", colStatus)) +
        chalk.gray("│"),
    );

    // Add separator row between official grades and calculated stats
    console.log(
      chalk.gray("├─") +
        chalk.gray("─".repeat(colMetric)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colScore)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colStatus)) +
        chalk.gray("┤"),
    );
  }

  // Add calculated statistics rows
  console.log(
    chalk.gray("│ ") +
      chalk.white(pad("Graded Assignments", colMetric)) +
      chalk.gray("│ ") +
      chalk.cyan.bold(
        pad(`${gradedAssignments.length} / ${assignments.length}`, colScore),
      ) +
      chalk.gray("│ ") +
      chalk.gray(pad("Completed", colStatus)) +
      chalk.gray("│"),
  );
  console.log(
    chalk.gray("│ ") +
      chalk.white(pad("Points Earned", colMetric)) +
      chalk.gray("│ ") +
      chalk.cyan.bold(
        pad(
          `${totalPointsEarned.toFixed(2)} / ${totalPointsPossible.toFixed(2)}`,
          colScore,
        ),
      ) +
      chalk.gray("│ ") +
      chalk.gray(pad("Total", colStatus)) +
      chalk.gray("│"),
  );
  console.log(
    chalk.gray("│ ") +
      chalk.white(pad("Calculated Average", colMetric)) +
      chalk.gray("│ ") +
      chalk.cyan.bold(
        pad(
          typeof calculatedPercentage === "string"
            ? calculatedPercentage
            : `${calculatedPercentage}%`,
          colScore,
        ),
      ) +
      chalk.gray("│ ") +
      chalk.gray(pad("From Graded", colStatus)) +
      chalk.gray("│"),
  );

  // Bottom border (rounded)
  console.log(
    chalk.gray("╰─") +
      chalk.gray("─".repeat(colMetric)) +
      chalk.gray("┴─") +
      chalk.gray("─".repeat(colScore)) +
      chalk.gray("┴─") +
      chalk.gray("─".repeat(colStatus)) +
      chalk.gray("╯"),
  );

  // Display assignment breakdown
  console.log(chalk.white.bold("\nAssignment Breakdown:"));

  if (assignments.length === 0) {
    console.log(chalk.yellow("  No assignments found for this course."));
  } else {
    // Calculate adaptive column widths
    const tw = process.stdout.columns || 100;
    const overhead = 16; // borders and padding
    const available = Math.max(80, tw - overhead);

    // Fixed minimum widths for data columns
    const colNo = Math.max(4, Math.min(6, Math.floor(available * 0.05)));
    const colScore = Math.max(10, Math.min(15, Math.floor(available * 0.12)));
    const colStatus = Math.max(10, Math.min(15, Math.floor(available * 0.12)));
    const colDate = Math.max(12, Math.min(20, Math.floor(available * 0.18)));
    // Name gets remaining space
    const colName = Math.max(
      20,
      available - colNo - colScore - colStatus - colDate,
    );

    // Top border (rounded)
    console.log(
      chalk.gray("╭─") +
        chalk.gray("─".repeat(colNo)) +
        chalk.gray("┬─") +
        chalk.gray("─".repeat(colName)) +
        chalk.gray("┬─") +
        chalk.gray("─".repeat(colScore)) +
        chalk.gray("┬─") +
        chalk.gray("─".repeat(colStatus)) +
        chalk.gray("┬─") +
        chalk.gray("─".repeat(colDate)) +
        chalk.gray("╮"),
    );

    // Header
    console.log(
      chalk.gray("│ ") +
        chalk.cyan.bold(pad("#", colNo)) +
        chalk.gray("│ ") +
        chalk.cyan.bold(pad("Assignment Name", colName)) +
        chalk.gray("│ ") +
        chalk.cyan.bold(pad("Score", colScore)) +
        chalk.gray("│ ") +
        chalk.cyan.bold(pad("Status", colStatus)) +
        chalk.gray("│ ") +
        chalk.cyan.bold(pad("Due Date", colDate)) +
        chalk.gray("│"),
    );

    // Header separator
    console.log(
      chalk.gray("├─") +
        chalk.gray("─".repeat(colNo)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colName)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colScore)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colStatus)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colDate)) +
        chalk.gray("┤"),
    );

    assignmentGrades.forEach((assignment, index) => {
      const scoreDisplay = assignment.graded
        ? `${(assignment.score || 0).toFixed(1)}/${assignment.pointsPossible}`
        : assignment.pointsPossible > 0
          ? `–/${assignment.pointsPossible}`
          : "N/A";

      let statusDisplay = "";
      let statusColor = chalk.gray;

      if (assignment.graded) {
        const percentage =
          assignment.pointsPossible > 0
            ? ((assignment.score || 0) / assignment.pointsPossible) * 100
            : 0;

        if (percentage >= 80) {
          statusDisplay = "✓ Graded";
          statusColor = chalk.green;
        } else if (percentage >= 50) {
          statusDisplay = "✓ Graded";
          statusColor = chalk.yellow;
        } else {
          statusDisplay = "✓ Graded";
          statusColor = chalk.red;
        }
      } else if (assignment.submitted) {
        statusDisplay = "Pending";
        statusColor = chalk.cyan;
      } else {
        statusDisplay = "Not Done";
        statusColor = chalk.gray;
      }

      const dueDate = assignment.dueAt
        ? new Date(assignment.dueAt).toLocaleDateString()
        : "No due date";

      // Truncate long assignment names
      let displayName = assignment.name;
      if (displayName.length > colName) {
        displayName = displayName.substring(0, colName - 3) + "...";
      }

      console.log(
        chalk.gray("│ ") +
          chalk.white(pad((index + 1).toString(), colNo)) +
          chalk.gray("│ ") +
          chalk.white(pad(displayName, colName)) +
          chalk.gray("│ ") +
          chalk.white(pad(scoreDisplay, colScore)) +
          chalk.gray("│ ") +
          statusColor(pad(statusDisplay, colStatus)) +
          chalk.gray("│ ") +
          chalk.gray(pad(dueDate, colDate)) +
          chalk.gray("│"),
      );
    });

    // Bottom border (rounded)
    console.log(
      chalk.gray("╰─") +
        chalk.gray("─".repeat(colNo)) +
        chalk.gray("┴─") +
        chalk.gray("─".repeat(colName)) +
        chalk.gray("┴─") +
        chalk.gray("─".repeat(colScore)) +
        chalk.gray("┴─") +
        chalk.gray("─".repeat(colStatus)) +
        chalk.gray("┴─") +
        chalk.gray("─".repeat(colDate)) +
        chalk.gray("╯"),
    );
  }

  console.log(chalk.cyan("=".repeat(80)));

  if (options.verbose && enrollment) {
    console.log(chalk.cyan("\n" + "-".repeat(80)));
    console.log(chalk.cyan.bold("Enrollment Details:"));
    console.log(chalk.white("  Enrollment ID: ") + enrollment.id);
    console.log(chalk.white("  Type:          ") + enrollment.type);
    console.log(chalk.white("  State:         ") + enrollment.enrollment_state);
    console.log(chalk.cyan("-".repeat(80)));
  }
}

export async function showGrades(
  courseId?: string,
  options: ShowGradesOptions = {},
): Promise<void> {
  try {
    if (courseId) {
      // Show grades for specific course with detailed assignment breakdown
      await showDetailedGrades(courseId, options);
    } else {
      // Interactive course selection or show summary for all courses
      const rl = createReadlineInterface();

      console.log(chalk.cyan.bold("\n" + "=".repeat(80)));
      console.log(chalk.cyan.bold("Loading your courses, please wait..."));

      // Determine enrollment state based on --all flag
      const enrollmentState = options.all ? undefined : "active";
      const queryParams = [
        "include[]=total_scores",
        "include[]=current_grading_period_scores",
        "per_page=100",
      ];

      if (enrollmentState) {
        queryParams.unshift(`enrollment_state=${enrollmentState}`);
      }

      let courses = await makeCanvasRequest<CanvasCourse[]>(
        "get",
        "courses",
        queryParams,
      );

      if (!courses || courses.length === 0) {
        console.log(chalk.red("Error: No courses found."));
        rl.close();
        return;
      }

      if (courses.length === 0) {
        console.log(chalk.red("Error: No courses found (after filtering)."));
        rl.close();
        return;
      }

      // Get enrollments with grades for each course
      const coursesWithGrades: Array<{
        course: CanvasCourse;
        enrollment: CanvasEnrollment | null;
      }> = [];

      for (const course of courses) {
        try {
          const enrollmentParams = ["user_id=self", "include[]=total_scores"];
          // Always include all states to ensure we find the enrollment
          enrollmentParams.push("state[]=active");
          enrollmentParams.push("state[]=invited");
          enrollmentParams.push("state[]=creation_pending");
          enrollmentParams.push("state[]=rejected");
          enrollmentParams.push("state[]=completed");
          enrollmentParams.push("state[]=inactive");

          const enrollments = await makeCanvasRequest<CanvasEnrollment[]>(
            "get",
            `courses/${course.id}/enrollments`,
            enrollmentParams,
          );
          coursesWithGrades.push({
            course,
            enrollment: enrollments[0] || null,
          });
        } catch {
          coursesWithGrades.push({
            course,
            enrollment: null,
          });
        }
      }
      console.log(chalk.cyan.bold("\n" + "=".repeat(80)));
      console.log(chalk.cyan.bold("Your Courses - Grades Summary"));
      console.log(
        chalk.green(
          `✓ Found ${coursesWithGrades.length} course(s)${options.all ? " (including inactive)" : " (active only)"}.`,
        ),
      );

      // Calculate dynamic column widths
      const colNo = Math.max(3, coursesWithGrades.length.toString().length + 1);

      const colStatus = Math.max(
        8,
        ...coursesWithGrades.map(
          (c) =>
            (c.course.workflow_state === "available"
              ? "Active"
              : c.course.workflow_state || "Inactive"
            ).length,
        ),
      );

      const colCurrent = Math.max(
        9,
        ...coursesWithGrades.map((c) => {
          const s = c.enrollment?.grades?.current_score;
          return s !== null && s !== undefined ? `${s}%`.length : 3;
        }),
      );

      const colFinal = Math.max(
        7,
        ...coursesWithGrades.map((c) => {
          const s = c.enrollment?.grades?.final_score;
          return s !== null && s !== undefined ? `${s}%`.length : 3;
        }),
      );

      // Calculate remaining width for name
      const terminalWidth = process.stdout.columns || 80;
      // Borders overhead: │ # │ Name │ Status │ Current │ Final │
      // 2 + colNo + 3 + colName + 3 + colStatus + 3 + colCurrent + 3 + colFinal + 2
      // Total overhead = 16 chars + other cols
      const overhead = 16;
      const availableForName = Math.max(
        20,
        terminalWidth - (colNo + colStatus + colCurrent + colFinal + overhead),
      );

      // Calculate max name length from data (min 11 for header "Course Name")
      const maxNameLength = Math.max(
        11,
        ...coursesWithGrades.map((c) => c.course.name.length),
      );
      const colName = Math.min(maxNameLength, availableForName);

      // Top border (rounded)
      console.log(
        chalk.gray("╭─") +
          chalk.gray("─".repeat(colNo)) +
          chalk.gray("┬─") +
          chalk.gray("─".repeat(colName)) +
          chalk.gray("┬─") +
          chalk.gray("─".repeat(colStatus)) +
          chalk.gray("┬─") +
          chalk.gray("─".repeat(colCurrent)) +
          chalk.gray("┬─") +
          chalk.gray("─".repeat(colFinal)) +
          chalk.gray("╮"),
      );

      // Header
      console.log(
        chalk.gray("│ ") +
          chalk.cyan.bold(pad("#", colNo)) +
          chalk.gray("│ ") +
          chalk.cyan.bold(pad("Course Name", colName)) +
          chalk.gray("│ ") +
          chalk.cyan.bold(pad("Status", colStatus)) +
          chalk.gray("│ ") +
          chalk.cyan.bold(pad("Current", colCurrent)) +
          chalk.gray("│ ") +
          chalk.cyan.bold(pad("Final", colFinal)) +
          chalk.gray("│"),
      );

      // Header separator
      console.log(
        chalk.gray("├─") +
          chalk.gray("─".repeat(colNo)) +
          chalk.gray("┼─") +
          chalk.gray("─".repeat(colName)) +
          chalk.gray("┼─") +
          chalk.gray("─".repeat(colStatus)) +
          chalk.gray("┼─") +
          chalk.gray("─".repeat(colCurrent)) +
          chalk.gray("┼─") +
          chalk.gray("─".repeat(colFinal)) +
          chalk.gray("┤"),
      );

      coursesWithGrades.forEach((item, index) => {
        const { course, enrollment } = item;
        const grades = enrollment?.grades;

        const currentScore =
          grades?.current_score !== null && grades?.current_score !== undefined
            ? `${grades.current_score}%`
            : "N/A";
        const finalScore =
          grades?.final_score !== null && grades?.final_score !== undefined
            ? `${grades.final_score}%`
            : "N/A";

        // Determine course status
        const statusText =
          course.workflow_state === "available"
            ? "Active"
            : course.workflow_state || "Inactive";
        const statusColored =
          course.workflow_state === "available"
            ? chalk.green(pad(statusText, colStatus))
            : chalk.gray(pad(statusText, colStatus));

        // Truncate long course names
        let displayName = course.name;
        if (displayName.length > colName) {
          displayName = displayName.substring(0, colName - 3) + "...";
        }

        console.log(
          chalk.gray("│ ") +
            chalk.white(pad((index + 1).toString(), colNo)) +
            chalk.gray("│ ") +
            chalk.white(pad(displayName, colName)) +
            chalk.gray("│ ") +
            statusColored +
            chalk.gray("│ ") +
            chalk.white(pad(currentScore, colCurrent)) +
            chalk.gray("│ ") +
            chalk.white(pad(finalScore, colFinal)) +
            chalk.gray("│"),
        );
      });

      // Bottom border (rounded)
      console.log(
        chalk.gray("╰─") +
          chalk.gray("─".repeat(colNo)) +
          chalk.gray("┴─") +
          chalk.gray("─".repeat(colName)) +
          chalk.gray("┴─") +
          chalk.gray("─".repeat(colStatus)) +
          chalk.gray("┴─") +
          chalk.gray("─".repeat(colCurrent)) +
          chalk.gray("┴─") +
          chalk.gray("─".repeat(colFinal)) +
          chalk.gray("╯"),
      );

      console.log(
        chalk.yellow(
          "\nSelect a course to view detailed grades for all assignments.",
        ),
      );
      console.log(chalk.gray("   Or enter 0 to exit."));
      if (!options.all) {
        console.log(
          chalk.gray("   Tip: Use --all flag to include inactive courses.\n"),
        );
      } else {
        console.log();
      }

      // Ask user to select a course
      const validator = (input: string): boolean => {
        const num = parseInt(input);
        return !isNaN(num) && num >= 0 && num <= coursesWithGrades.length;
      };

      const answer = await askQuestionWithValidation(
        rl,
        chalk.bold.cyan("Enter course number: "),
        validator,
        chalk.red(
          `Please enter a number between 0 and ${coursesWithGrades.length}.`,
        ),
      );

      const choice = parseInt(answer);
      rl.close();

      if (choice === 0) {
        console.log(chalk.yellow("\nExiting grades viewer."));
        return;
      }

      const selectedCourse = coursesWithGrades[choice - 1];
      if (selectedCourse) {
        console.log(
          chalk.green(`\n✓ Selected: ${selectedCourse.course.name}\n`),
        );
        await showDetailedGrades(String(selectedCourse.course.id), options);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching grades:"), errorMessage);
    process.exit(1);
  }
}
