/**
 * Todo command - View all pending Canvas items across courses
 */

import { makeCanvasRequest, getCanvasCourses } from "../lib/api-client.js";
import { Table, printInfo } from "../lib/display.js";
import chalk from "chalk";
import type { CanvasTodoItem, ShowTodoOptions } from "../types/index.js";

interface TodoDisplayItem {
  type: string;
  title: string;
  course: string;
  dueAt: Date | null;
  points: number;
  url: string;
}

function formatTimeRemaining(dueDate: Date | null): {
  text: string;
  color: typeof chalk;
} {
  if (!dueDate) {
    return { text: "No due date", color: chalk.gray };
  }

  const now = new Date();
  const diff = dueDate.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diff < 0) {
    const pastDays = Math.abs(days);
    if (pastDays === 0) return { text: "Today (overdue)", color: chalk.red };
    if (pastDays === 1) return { text: "1d overdue", color: chalk.red };
    return { text: `${pastDays}d overdue`, color: chalk.red };
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

function formatDueDate(date: Date | null): string {
  if (!date) return "No due date";
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:${mins}`;
}

export async function showTodo(options: ShowTodoOptions = {}): Promise<void> {
  try {
    const limit = parseInt(options.limit || "20", 10);

    printInfo("\n" + "-".repeat(60));
    printInfo("Loading your todo items...");

    // Fetch todo items from Canvas API
    const todoItems = await makeCanvasRequest<CanvasTodoItem[]>(
      "get",
      "users/self/todo",
      ["per_page=100"],
    );

    if (!todoItems || todoItems.length === 0) {
      console.log(
        chalk.green.bold("\nYou're all caught up! No pending items."),
      );
      return;
    }

    // Get courses for mapping course names
    const courses = await getCanvasCourses(true);
    const courseMap = new Map<number, string>();
    courses.forEach((course) => {
      courseMap.set(course.id, course.name);
    });

    // Transform todo items for display
    const displayItems: TodoDisplayItem[] = todoItems.map((item) => {
      let title = "";
      let dueAt: Date | null = null;
      let points = 0;
      let type = item.type || "task";

      if (item.assignment) {
        title = item.assignment.name;
        dueAt = item.assignment.due_at
          ? new Date(item.assignment.due_at)
          : null;
        points = item.assignment.points_possible || 0;
        type = "assignment";
      } else if (item.quiz) {
        title = item.quiz.title;
        dueAt = item.quiz.due_at ? new Date(item.quiz.due_at) : null;
        points = item.quiz.points_possible || 0;
        type = "quiz";
      }

      const courseName = item.course_id
        ? courseMap.get(item.course_id) || `Course ${item.course_id}`
        : "Unknown";

      return {
        type,
        title,
        course: courseName,
        dueAt,
        points,
        url: item.html_url,
      };
    });

    // Sort by due date (items with no due date go last)
    displayItems.sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.getTime() - b.dueAt.getTime();
    });

    // Limit items if needed
    const limitedItems = displayItems.slice(0, limit);

    console.log(
      chalk.cyan.bold(
        `\nTodo Items (${limitedItems.length} of ${displayItems.length})`,
      ),
    );
    console.log(chalk.gray("-".repeat(60)));

    const table = new Table(
      [
        {
          key: "type",
          header: "Type",
          minWidth: 6,
          maxWidth: 12,
        },
        {
          key: "title",
          header: "Title",
          flex: 2,
          minWidth: 15,
          maxWidth: 50,
        },
        {
          key: "course",
          header: "Course",
          flex: 1,
          minWidth: 10,
          maxWidth: 30,
        },
        {
          key: "due",
          header: "Due",
          minWidth: 12,
          maxWidth: 18,
          color: (value: string, row: Record<string, any>) => {
            const { color } = formatTimeRemaining(row.dueAtRaw);
            return color(value);
          },
        },
        {
          key: "remaining",
          header: "Time Left",
          minWidth: 10,
          maxWidth: 15,
          color: (value: string, row: Record<string, any>) => {
            const { color } = formatTimeRemaining(row.dueAtRaw);
            return color(value);
          },
        },
        {
          key: "points",
          header: "Points",
          minWidth: 6,
          maxWidth: 10,
          align: "right" as const,
        },
      ],
      { title: "" },
    );

    limitedItems.forEach((item) => {
      const timeInfo = formatTimeRemaining(item.dueAt);
      table.addRow({
        type: item.type,
        title: item.title,
        course: item.course,
        due: formatDueDate(item.dueAt),
        remaining: timeInfo.text,
        points: item.points > 0 ? item.points.toString() : "-",
        dueAtRaw: item.dueAt,
      });
    });

    table.render();

    // Summary
    const overdue = displayItems.filter(
      (item) => item.dueAt && item.dueAt < new Date(),
    ).length;
    const dueToday = displayItems.filter((item) => {
      if (!item.dueAt) return false;
      const now = new Date();
      return (
        item.dueAt.getDate() === now.getDate() &&
        item.dueAt.getMonth() === now.getMonth() &&
        item.dueAt.getFullYear() === now.getFullYear() &&
        item.dueAt > now
      );
    }).length;

    console.log("");
    if (overdue > 0) {
      console.log(chalk.red(`${overdue} item(s) overdue`));
    }
    if (dueToday > 0) {
      console.log(chalk.yellow(`${dueToday} item(s) due today`));
    }

    if (displayItems.length > limit) {
      console.log(
        chalk.gray(
          `\nShowing ${limit} of ${displayItems.length} items. Use -l <number> to see more.`,
        ),
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle permission errors gracefully
    if (
      errorMessage.includes("Access denied") ||
      errorMessage.includes("permission")
    ) {
      console.log(chalk.yellow("\nUnable to access todo items."));
      console.log(
        chalk.gray("You may not have permission to view this information."),
      );
      return;
    }

    console.error(chalk.red("Error:"), errorMessage);
  }
}
