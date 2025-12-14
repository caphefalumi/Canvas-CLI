/**
 * Assignments command
 */

import { makeCanvasRequest, getCanvasCourse } from "../lib/api-client.js";
import {
  pickCourse,
  displayAssignments,
  printInfo,
  printError,
  printSuccess,
  printSeparator,
} from "../lib/display.js";
import chalk from "chalk";
import type {
  CanvasCourse,
  CanvasAssignment,
  ListAssignmentsOptions,
} from "../types/index.js";

export async function listAssignments(
  courseName?: string,
  options: ListAssignmentsOptions = {},
): Promise<void> {
  try {
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
      course = await getCanvasCourse(courseName);
      if (!course) {
        printError(`Course "${courseName}" not found.`);
        return;
      }
      selectedCourseId = course.id.toString();
      printSuccess(`✓ Using course: ${course.name}`);
    }

    printSeparator("─", 60);

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
