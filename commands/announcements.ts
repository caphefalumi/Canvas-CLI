/**
 * Announcements command
 */

import { makeCanvasRequest, getCanvasCourses } from "../lib/api-client.js";
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
} from "../types/index.js";

export async function showAnnouncements(
  courseName?: string,
  options: ShowAnnouncementsOptions = {},
): Promise<void> {
  let rl: ReturnType<typeof createReadlineInterface> | null = null;

  try {
    let selectedCourseId = courseName;

    if (!selectedCourseId) {
      const result = await pickCourse({
        title: "\nLoading your courses, please wait...",
      });
      if (!result) return;

      selectedCourseId = result.course.id.toString();
      rl = result.rl;
    } else {
      rl = createReadlineInterface();
      // selectedCourseId = await getCanvasCourses(courseName)
    }

    const limit = parseInt(options.limit || "5") || 5;
    printInfo("Loading announcements...");

    const announcements = await makeCanvasRequest<CanvasAnnouncement[]>(
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
    const announcementTable = displayAnnouncements(announcements);

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
