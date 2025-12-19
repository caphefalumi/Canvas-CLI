/**
 * List courses command
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { Table, printInfo, printError, printSuccess } from "../lib/display.js";
import { readConfig } from "../lib/config.js";
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

    // Use detailed list format for narrow terminals in verbose mode
    const terminalWidth = process.stdout.columns || 80;
    if (options.verbose && terminalWidth < 150) {
      filteredCourses.forEach((course, index) => {
        console.log(chalk.bold(`\n${index + 1}. ${course.name}`));
        console.log(`   ID: ${course.id}`);

        if (terminalWidth >= 70) {
          console.log(`   Code: ${course.course_code || "N/A"}`);
          console.log(`   Term: ${course.term?.name || "N/A"}`);
        } else {
          // For very narrow terminals, show abbreviated info
          const code = course.course_code
            ? course.course_code.split("-").slice(0, 2).join("-")
            : "N/A";
          const term = course.term?.name
            ? course.term.name.split(" ").slice(0, 3).join(" ")
            : "N/A";
          console.log(`   Code: ${code}...`);
          console.log(`   Term: ${term}...`);
        }
      });
      return;
    }

    const columns = [
      {
        key: "name",
        header: "Course Name",
        flex: 3,
        minWidth: 50,
        maxWidth: 200,
      },
      { key: "id", header: "ID", minWidth: 6, maxWidth: 10 },
    ];

    if (options.verbose) {
      columns.push(
        { key: "code", header: "Code", flex: 2, minWidth: 30, maxWidth: 200 },
        { key: "term", header: "Term", flex: 2, minWidth: 30, maxWidth: 200 },
      );
    }

    const config = readConfig();

    const table = new Table(columns, {
      truncate: config?.tableTruncate !== false,
    });

    filteredCourses.forEach((course) => {
      const row: any = {
        name: course.name,
        id: course.id,
      };

      if (options.verbose) {
        row.code = course.course_code || "N/A";
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
