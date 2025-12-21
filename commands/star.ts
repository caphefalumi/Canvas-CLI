/**
 * Star/Unstar course command
 */

import {
  getCanvasCourse,
  getCanvasCourses,
  makeCanvasRequest,
} from "../lib/api-client.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import chalk from "chalk";
import type { CanvasCourse } from "../types/index.js";

/**
 * Star a course
 */
export async function starCourse(courseName?: string): Promise<void> {
  const rl = createReadlineInterface();

  try {
    console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
    console.log(chalk.cyan.bold("Star Course"));
    console.log(chalk.cyan("-".repeat(60)));

    // Get all courses
    const courses = await getCanvasCourses(true);

    if (!courses || courses.length === 0) {
      console.log(chalk.red("Error: No courses found."));
      rl.close();
      return;
    }

    let selectedCourse: CanvasCourse | undefined;

    if (courseName) {
      selectedCourse = await getCanvasCourse(courseName, rl, {
        onlyStarred: true,
        successMessage: " ",
      });
      if (!selectedCourse) {
        rl.close();
        return;
      }
    } else {
      // Interactive selection
      console.log(chalk.cyan(`\nAll courses (${courses.length}):\n`));
      courses.forEach((course, index) => {
        const star = course.is_favorite ? chalk.yellow("★") : " ";
        console.log(
          `${index + 1}. ${star} ${course.name} (${course.course_code})`,
        );
      });

      const choice = await askQuestion(rl, "\nEnter course number to star: ");
      const index = parseInt(choice) - 1;

      if (index >= 0 && index < courses.length) {
        selectedCourse = courses[index];
      } else {
        console.log(chalk.red("Invalid selection."));
        rl.close();
        return;
      }
    }

    if (!selectedCourse) {
      console.log(chalk.red("No course selected."));
      rl.close();
      return;
    }

    // Check if already starred
    if (selectedCourse.is_favorite) {
      console.log(chalk.yellow(`"${selectedCourse.name}" is already starred.`));
      rl.close();
      return;
    }

    // Star the course
    await makeCanvasRequest(
      "post",
      `users/self/favorites/courses/${selectedCourse.id}`,
    );

    console.log(chalk.green(`✓ Successfully starred "${selectedCourse.name}"`));
    rl.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error: ") + errorMessage);
    rl.close();
    process.exit(1);
  }
}

/**
 * Unstar a course
 */
export async function unstarCourse(courseName?: string): Promise<void> {
  const rl = createReadlineInterface();

  try {
    console.log(chalk.cyan.bold("\n" + "-".repeat(60)));
    console.log(chalk.cyan.bold("Unstar Course"));
    console.log(chalk.cyan("-".repeat(60)));

    // Get all courses
    const courses = await getCanvasCourses(true);

    if (!courses || courses.length === 0) {
      console.log(chalk.red("Error: No courses found."));
      rl.close();
      return;
    }

    let selectedCourse: CanvasCourse | undefined;

    if (courseName) {
      selectedCourse = await getCanvasCourse(courseName, rl, {
        onlyStarred: true,
        successMessage: " ",
      });
      if (!selectedCourse) {
        rl.close();
        return;
      }
    } else {
      // Interactive selection - show only starred courses
      const starredCourses = courses.filter((c) => c.is_favorite);

      if (starredCourses.length === 0) {
        console.log(chalk.yellow("No starred courses found!"));
        rl.close();
        return;
      }

      console.log(
        chalk.cyan(`\nStarred courses (${starredCourses.length}):\n`),
      );
      starredCourses.forEach((course, index) => {
        console.log(
          `${index + 1}. ${chalk.yellow("★")} ${course.name} (${course.course_code})`,
        );
      });

      const choice = await askQuestion(rl, "\nEnter course number to unstar: ");
      const index = parseInt(choice) - 1;

      if (index >= 0 && index < starredCourses.length) {
        selectedCourse = starredCourses[index];
      } else {
        console.log(chalk.red("Invalid selection."));
        rl.close();
        return;
      }
    }

    if (!selectedCourse) {
      console.log(chalk.red("No course selected."));
      rl.close();
      return;
    }

    // Check if not starred
    if (!selectedCourse.is_favorite) {
      console.log(chalk.yellow(`"${selectedCourse.name}" is not starred.`));
      rl.close();
      return;
    }

    // Unstar the course
    await makeCanvasRequest(
      "delete",
      `users/self/favorites/courses/${selectedCourse.id}`,
    );

    console.log(
      chalk.green(`✓ Successfully unstarred "${selectedCourse.name}"`),
    );
    rl.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error: ") + errorMessage);
    rl.close();
    process.exit(1);
  }
}
