import { describe, test, expect, beforeEach } from "bun:test";
import { displayCourses } from "../lib/display";
import type { CanvasCourse } from "../types";

let logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(" "));
  // Set consistent terminal width for all tests
  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    writable: true,
    configurable: true,
  });
});

function restoreLog() {
  console.log = originalLog;
}

describe("Announcements and Course Display", () => {
  test("displayCourses renders course table", () => {
    const courses: Partial<CanvasCourse>[] = [
      {
        id: 1,
        name: "Introduction to Computer Science",
        course_code: "CS101",
      },
      {
        id: 2,
        name: "Data Structures and Algorithms with a very long course name that should truncate",
        course_code: "CS201",
      },
    ];

    try {
      displayCourses(courses as CanvasCourse[], {}, (str: string) =>
        logs.push(str),
      );
      const rendered = logs.join("\n");

      expect(rendered).toContain("Computer Science");
      expect(rendered).toContain("│");
      expect(rendered).toContain("╭");
      expect(rendered).toContain("╰");
    } finally {
      restoreLog();
    }
  });

  test("displayCourses with showId option", () => {
    const courses: Partial<CanvasCourse>[] = [
      {
        id: 12345,
        name: "Test Course",
        course_code: "TEST",
      },
    ];

    try {
      displayCourses(
        courses as CanvasCourse[],
        { showId: true },
        (str: string) => logs.push(str),
      );
      const rendered = logs.join("\n");

      expect(rendered).toContain("ID");
      expect(rendered).toContain("12345");
    } finally {
      restoreLog();
    }
  });

  test("displayCourses handles empty course list", () => {
    try {
      displayCourses([], {}, (str: string) => logs.push(str));
      const rendered = logs.join("\n");

      // Should still render table structure
      expect(rendered).toContain("│");
    } finally {
      restoreLog();
    }
  });

  test("displayCourses handles single course", () => {
    const courses: Partial<CanvasCourse>[] = [
      {
        id: 1,
        name: "Single Course",
        course_code: "SINGLE",
      },
    ];

    try {
      displayCourses(courses as CanvasCourse[], {}, (str: string) =>
        logs.push(str),
      );
      const rendered = logs.join("\n");

      expect(rendered).toContain("Single Course");
      expect(rendered).toContain("Course Name");
    } finally {
      restoreLog();
    }
  });
});
