/**
 * Calendar command - View upcoming due dates across all courses
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { Table, printInfo, printError, printSuccess } from "../lib/display.js";
import chalk from "chalk";
import type { CanvasCourse, CanvasAssignment } from "../types/index.js";

export interface CalendarOptions {
  days?: string;
  all?: boolean;
  past?: boolean;
}

interface DueItem {
  courseName: string;
  courseId: number;
  assignmentName: string;
  assignmentId: number;
  dueAt: Date;
  submitted: boolean;
  pointsPossible: number;
}

function formatTimeRemaining(dueDate: Date): {
  text: string;
  color: typeof chalk;
} {
  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diff < 0) {
    const pastDays = Math.abs(days);
    if (pastDays === 0) return { text: "Today", color: chalk.red };
    if (pastDays === 1) return { text: "1d ago", color: chalk.red };
    return { text: `${pastDays}d ago`, color: chalk.red };
  }

  if (days === 0) {
    if (hours <= 1) return { text: "< 1 hour", color: chalk.red };
    return { text: `${hours} hours`, color: chalk.red };
  }
  if (days === 1) return { text: "Tomorrow", color: chalk.yellow };
  if (days <= 3) return { text: `${days} days`, color: chalk.yellow };
  if (days <= 7) return { text: `${days} days`, color: chalk.cyan };
  return { text: `${days} days`, color: chalk.green };
}

function formatDueDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

export async function showCalendar(
  options: CalendarOptions = {},
): Promise<void> {
  try {
    const days = parseInt(options.days || "14", 10);
    const showPast = options.past || false;

    printInfo("\n" + "-".repeat(60));
    printInfo("Loading upcoming due dates...");

    const queryParams = ["enrollment_state=active", "include[]=favorites"];
    const courses = await makeCanvasRequest<CanvasCourse[]>(
      "get",
      "courses",
      queryParams,
    );

    if (!courses || courses.length === 0) {
      printError("No courses found.");
      return;
    }

    let targetCourses = courses;
    if (!options.all) {
      const starred = courses.filter((c) => c.is_favorite);
      if (starred.length > 0) {
        targetCourses = starred;
      }
    }

    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const assignmentPromises = targetCourses.map(async (course) => {
      try {
        const assignments = await makeCanvasRequest<CanvasAssignment[]>(
          "get",
          `courses/${course.id}/assignments`,
          ["include[]=submission", "per_page=100"],
        );
        return { course, assignments: assignments || [] };
      } catch {
        return { course, assignments: [] };
      }
    });

    const results = await Promise.all(assignmentPromises);
    const dueItems: DueItem[] = [];

    for (const { course, assignments } of results) {
      for (const assignment of assignments) {
        if (!assignment.due_at) continue;

        const dueAt = new Date(assignment.due_at);
        const submission = (assignment as any).submission;
        const isSubmitted = !!(submission && submission.submitted_at);

        if (showPast) {
          if (dueAt < pastDate || dueAt > futureDate) continue;
        } else {
          if (dueAt < now || dueAt > futureDate) continue;
        }

        dueItems.push({
          courseName: course.name,
          courseId: course.id,
          assignmentName: assignment.name,
          assignmentId: assignment.id,
          dueAt,
          submitted: isSubmitted,
          pointsPossible: assignment.points_possible || 0,
        });
      }
    }

    dueItems.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    if (dueItems.length === 0) {
      console.log(
        chalk.yellow(`\nNo upcoming assignments due in the next ${days} days.`),
      );
      if (!options.all) {
        console.log(chalk.gray("Tip: Use --all to include all courses."));
      }
      return;
    }

    const courseLabel = options.all ? "all courses" : "starred courses";
    console.log(
      chalk.cyan.bold(
        `\nUpcoming Due Dates (${courseLabel}, next ${days} days)`,
      ),
    );
    printSuccess(`Found ${dueItems.length} upcoming assignment(s).`);

    const table = new Table(
      [
        { key: "course", header: "Course", flex: 1, minWidth: 10 },
        { key: "assignment", header: "Assignment", flex: 1, minWidth: 15 },
        { key: "due", header: "Due", width: 12 },
        {
          key: "remaining",
          header: "Remaining",
          width: 10,
          color: (value, row) => {
            const colorFn = row._remainingColor;
            return colorFn ? colorFn(value) : chalk.white(value);
          },
        },
        {
          key: "status",
          header: "Status",
          width: 8,
          color: (value, row) =>
            row._submitted ? chalk.green(value) : chalk.yellow(value),
        },
      ],
      { showRowNumbers: true },
    );

    for (const item of dueItems) {
      const remaining = formatTimeRemaining(item.dueAt);

      table.addRow({
        course: item.courseName,
        assignment: item.assignmentName,
        due: formatDueDate(item.dueAt),
        remaining: remaining.text,
        status: item.submitted ? "Done" : "Pending",
        _submitted: item.submitted,
        _remainingColor: remaining.color,
      });
    }

    table.renderWithResize();

    const pending = dueItems.filter((d) => !d.submitted).length;
    const done = dueItems.filter((d) => d.submitted).length;
    console.log(chalk.gray(`\n  ${pending} pending, ${done} submitted`));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching calendar:"), errorMessage);
    process.exit(1);
  }
}
