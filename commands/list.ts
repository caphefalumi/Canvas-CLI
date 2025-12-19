/**
 * List courses command
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { Table, printInfo, printError, printSuccess } from "../lib/display.js";
import chalk from "chalk";
import type { CanvasCourse, ListCoursesOptions } from "../types/index.js";

export async function listCourses(options: ListCoursesOptions): Promise<void> {
  try {
    const queryParams: string[] = [];
    queryParams.push("enrollment_state=active");
    queryParams.push("include[]=term");
    queryParams.push("include[]=course_progress");
    queryParams.push("include[]=total_students");
    queryParams.push("include[]=favorites");

    printInfo("\n" + "-".repeat(60));
    printInfo("Loading courses, please wait...");

    const courses = await makeCanvasRequest<CanvasCourse[]>(
      "get",
      "courses",
      queryParams,
    );

    if (!courses || courses.length === 0) {
      printError("No courses found.");
      return;
    }

    let filteredCourses = courses;
    if (!options.all) {
      filteredCourses = courses.filter((course) => course.is_favorite);
      if (filteredCourses.length === 0) {
        printError("No starred courses found. Use -a to see all courses.");
        return;
      }
    }

    const courseLabel = options.all
      ? "enrolled course(s)"
      : "starred course(s)";
    printSuccess(`Found ${filteredCourses.length} ${courseLabel}.`);

    const columns = [
      { key: "name", header: "Course Name", flex: 1, minWidth: 20 },
      { key: "id", header: "ID", minWidth: 6, maxWidth: 10 },
    ];

    if (options.verbose) {
      columns.push(
        { key: "code", header: "Code", minWidth: 10, maxWidth: 15 },
        { key: "state", header: "State", minWidth: 8, maxWidth: 12 },
        { key: "term", header: "Term", minWidth: 10, maxWidth: 20 },
      );
    }

    const table = new Table(columns);

    filteredCourses.forEach((course) => {
      const row: any = {
        name: course.name,
        id: course.id,
      };

      if (options.verbose) {
        row.code = course.course_code || "N/A";
        row.state = course.workflow_state || "N/A";
        row.term = course.term?.name || "N/A";
      }

      table.addRow(row);
    });

    table.render();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching courses:"), errorMessage);
    process.exit(1);
  }
}
