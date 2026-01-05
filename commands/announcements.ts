/**
 * Announcements command
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import {
  pickCourse,
  displayAnnouncements,
  displayAnnouncementDetail,
  printInfo,
  printError,
  printSuccess,
  printWarning,
} from "../lib/display.js";
import chalk from "chalk";
import type {
  CanvasAnnouncement,
  ShowAnnouncementsOptions,
  CanvasCourse,
} from "../types/index.js";

export async function showAnnouncements(
  courseName?: string,
  options: ShowAnnouncementsOptions = {},
): Promise<void> {
  let rl: ReturnType<typeof createReadlineInterface> | null = null;

  try {
    const limit = parseInt(options.limit || "5") || 5;
    let announcements: CanvasAnnouncement[] = [];

    // Handle --all flag: fetch announcements from all courses
    if (options.all) {
      rl = createReadlineInterface();
      printInfo("Loading announcements from all courses...");

      // Fetch all active courses
      const courses = await makeCanvasRequest<CanvasCourse[]>(
        "get",
        "courses",
        ["enrollment_state=active"],
      );

      if (!courses || courses.length === 0) {
        printWarning("No courses found.");
        rl?.close();
        return;
      }

      // Build context_codes for API request
      const contextCodes = courses.map((c) => `course_${c.id}`);

      // Fetch announcements using the announcements endpoint with context_codes
      announcements = await makeCanvasRequest<CanvasAnnouncement[]>(
        "get",
        "announcements",
        [
          ...contextCodes.map((code) => `context_codes[]=${code}`),
          `per_page=${limit}`,
        ],
      );

      if (!announcements || announcements.length === 0) {
        printWarning("No announcements found across all courses.");
        rl?.close();
        return;
      }

      printSuccess(
        `Found ${announcements.length} announcement(s) from all courses.`,
      );
    } else {
      // Single-course logic using pickCourse
      const result = await pickCourse({
        courseName: courseName,
      });

      if (!result) return;

      const selectedCourseId = result.course.id.toString();
      rl = result.rl;

      printInfo("Loading announcements...");

      announcements = await makeCanvasRequest<CanvasAnnouncement[]>(
        "get",
        `courses/${selectedCourseId}/discussion_topics`,
        [`only_announcements=true`, `per_page=${limit}`],
      );

      if (!announcements || announcements.length === 0) {
        printWarning("No announcements found for this course.");
        rl?.close();
        return;
      }

      printSuccess(`Found ${announcements.length} announcement(s).`);
    }

    // DEBUG: Log raw HTML from Canvas API (only if --debug flag is set)
    if (options.debug) {
      console.log(
        chalk.yellow(
          "\n========== RAW CANVAS API RESPONSE (First Announcement) ==========",
        ),
      );
      if (announcements[0]) {
        console.log(chalk.cyan("Title:"), announcements[0].title);
        console.log(chalk.cyan("\nRaw Message (HTML):"));
        console.log(chalk.gray(announcements[0].message));
        console.log(
          chalk.yellow(
            "\n==================================================================\n",
          ),
        );
      }
    }

    const announcementTable = displayAnnouncements(
      announcements,
      options.verbose,
    );

    const annChoice = await askQuestion(
      rl!,
      chalk.bold.cyan(
        "\nEnter announcement number to view details (0 to exit): ",
      ),
    );

    // Stop watching for resize after user input
    announcementTable.stopWatching();

    if (!annChoice.trim() || annChoice === "0") {
      printWarning("Exiting announcements viewer.");
      rl?.close();
      return;
    }

    const annIndex = parseInt(annChoice) - 1;
    if (annIndex < 0 || annIndex >= announcements.length) {
      printError("Invalid announcement selection.");
      rl?.close();
      return;
    }

    const ann = announcements[annIndex];
    displayAnnouncementDetail({
      title: ann?.title || "Untitled",
      postedAt: ann?.posted_at || null,
      author: ann?.author?.display_name || "Unknown",
      message: ann?.message || "No content",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red("Error: Failed to fetch announcements: ") + errorMessage,
    );
  } finally {
    rl?.close();
  }
}
