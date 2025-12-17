/**
 * Grades command
 */

import { makeCanvasRequest, getCanvasCourse } from "../lib/api-client.js";
import {
  createReadlineInterface,
  askQuestionWithValidation,
} from "../lib/interactive.js";
import { Table } from "../lib/display.js";
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

  // Display overall grades using Table class
  console.log(chalk.white.bold("\nOverall Grades:"));

  const overallTable = new Table(
    [
      { key: "metric", header: "Metric", flex: 1.5, minWidth: 18 },
      {
        key: "value",
        header: "Score/Grade",
        flex: 2,
        minWidth: 20,
        color: (val, row) => {
          if (row.metric.includes("Current") || row.metric.includes("Final")) {
            return chalk.green.bold(val);
          }
          return chalk.cyan.bold(val);
        },
      },
      { key: "status", header: "Status", flex: 1, minWidth: 12 },
    ],
    { showRowNumbers: false, title: undefined },
  );

  if (grades) {
    const hasFinalScore =
      grades.final_score !== null && grades.final_score !== undefined;

    if (hasFinalScore) {
      // Only show final scores/grades if available
      const finalScoreValue = `${grades.final_score}%`;
      const finalGradeValue = grades.final_grade || "N/A";

      overallTable.addRows([
        { metric: "Final Score", value: finalScoreValue, status: "Official" },
        {
          metric: "Final Grade",
          value: finalGradeValue,
          status: "Letter Grade",
        },
      ]);
    } else {
      // Show current scores/grades if final is not available
      const currentScoreValue =
        grades.current_score !== null ? `${grades.current_score}%` : "N/A";
      const currentGradeValue = grades.current_grade || "N/A";

      overallTable.addRows([
        {
          metric: "Current Score",
          value: currentScoreValue,
          status: "Official",
        },
        {
          metric: "Current Grade",
          value: currentGradeValue,
          status: "Letter Grade",
        },
      ]);
    }
  }

  overallTable.addRows([
    {
      metric: "Graded Assignments",
      value: `${gradedAssignments.length} / ${assignments.length}`,
      status: "Completed",
    },
    {
      metric: "Points Earned",
      value: `${totalPointsEarned.toFixed(2)} / ${totalPointsPossible.toFixed(2)}`,
      status: "Total",
    },
  ]);

  overallTable.render();

  // Display assignment breakdown using Table class
  console.log(chalk.white.bold("\nAssignment Breakdown:"));

  if (assignments.length === 0) {
    console.log(chalk.yellow("  No assignments found for this course."));
  } else {
    const assignmentTable = new Table(
      [
        { key: "name", header: "Assignment Name", flex: 3, minWidth: 20 },
        { key: "score", header: "Score", minWidth: 10, maxWidth: 15 },
        {
          key: "status",
          header: "Status",
          minWidth: 10,
          maxWidth: 15,
          color: (val, row) => {
            if (row.statusRaw === "graded") {
              const percentage = row.percentageRaw || 0;
              if (percentage >= 80) return chalk.green(val);
              if (percentage >= 50) return chalk.yellow(val);
              return chalk.red(val);
            }
            if (row.statusRaw === "submitted") return chalk.cyan(val);
            return chalk.gray(val);
          },
        },
        { key: "dueDate", header: "Due Date", minWidth: 12, maxWidth: 20 },
      ],
      { showRowNumbers: true, rowNumberHeader: "#" },
    );

    assignmentGrades.forEach((assignment) => {
      const scoreDisplay = assignment.graded
        ? `${(assignment.score || 0).toFixed(1)}/${assignment.pointsPossible}`
        : assignment.pointsPossible > 0
          ? `–/${assignment.pointsPossible}`
          : "N/A";

      let statusDisplay = "";
      let statusRaw = "";
      let percentageRaw = 0;

      if (assignment.graded) {
        statusRaw = "graded";
        percentageRaw =
          assignment.pointsPossible > 0
            ? ((assignment.score || 0) / assignment.pointsPossible) * 100
            : 0;
        statusDisplay = "✓ Graded";
      } else if (assignment.submitted) {
        statusRaw = "submitted";
        statusDisplay = "Pending";
      } else {
        statusRaw = "not-done";
        statusDisplay = "Not Done";
      }

      const dueDate = assignment.dueAt
        ? new Date(assignment.dueAt).toLocaleDateString()
        : "No due date";

      assignmentTable.addRow({
        name: assignment.name,
        score: scoreDisplay,
        status: statusDisplay,
        statusRaw,
        percentageRaw,
        dueDate,
      });
    });

    assignmentTable.render();
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
  courseName?: string,
  options: ShowGradesOptions = {},
): Promise<void> {
  try {
    if (courseName) {
      // Show grades for specific course with detailed assignment breakdown
      const course = await getCanvasCourse(courseName);
      if (!course) {
        console.log(chalk.red(`Error: Course "${courseName}" not found.`));
        return;
      }
      console.log(chalk.green(`✓ Using course: ${course.name}`));
      await showDetailedGrades(course.id.toString(), options);
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

      // Create courses summary table using Table class
      const coursesTable = new Table(
        [
          { key: "name", header: "Course Name", flex: 3, minWidth: 20 },
          {
            key: "status",
            header: "Status",
            minWidth: 8,
            color: (val, row) => {
              return row.statusRaw === "available"
                ? chalk.green(val)
                : chalk.gray(val);
            },
          },
          { key: "current", header: "Current", minWidth: 9 },
          { key: "final", header: "Final", minWidth: 7 },
        ],
        { showRowNumbers: true, rowNumberHeader: "#" },
      );

      coursesWithGrades.forEach((item) => {
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

        const statusText =
          course.workflow_state === "available"
            ? "Active"
            : course.workflow_state || "Inactive";

        coursesTable.addRow({
          name: course.name,
          status: statusText,
          statusRaw: course.workflow_state,
          current: currentScore,
          final: finalScore,
        });
      });

      coursesTable.render();

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
