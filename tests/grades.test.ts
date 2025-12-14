import { describe, test, expect, beforeEach } from "bun:test";
import type { CanvasAssignment } from "../types";
import { formatGrade, displayAssignments } from "../lib/display";

// Mock console.log to capture output
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

function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

describe("Grades Display", () => {
  test("formatGrade displays scores correctly", () => {
    const submission = { score: 85, submitted_at: "2025-01-01" };
    const result = formatGrade(submission, 100);

    expect(result.text).toBe("85/100");
    expect(stripAnsi(result.color(result.text))).toBe("85/100");
  });

  test("formatGrade handles decimal scores", () => {
    const submission = { score: 87.5, submitted_at: "2025-01-01" };
    const result = formatGrade(submission, 100);

    expect(result.text).toBe("87.5/100");
  });

  test("formatGrade color function returns text", () => {
    const submission = { score: 90, submitted_at: "2025-01-01" };
    const result = formatGrade(submission, 100);

    const colored = result.color(result.text);
    // Color function should return text (with or without ANSI codes depending on env)
    expect(stripAnsi(colored)).toBe("90/100");
  });

  test("formatGrade handles excused assignments", () => {
    const submission = { excused: true };
    const result = formatGrade(submission, 100);

    expect(result.text).toBe("Excused");
  });

  test("formatGrade handles missing assignments", () => {
    const submission = { missing: true };
    const result = formatGrade(submission, 100);

    expect(result.text).toBe("Missing");
  });

  test("formatGrade handles unsubmitted assignments", () => {
    const submission = null;
    const result = formatGrade(submission, 50);

    expect(result.text).toBe("–/50");
  });
});

describe("Assignments Display", () => {
  test("displayAssignments renders assignment table", () => {
    const assignments: Partial<CanvasAssignment>[] = [
      {
        id: 1,
        name: "Assignment 1",
        due_at: "2025-12-20T23:59:00Z",
        points_possible: 100,
      },
      {
        id: 2,
        name: "Assignment 2 with a very long name that should be truncated",
        due_at: "2025-12-25T23:59:00Z",
        points_possible: 50,
      },
    ];

    try {
      displayAssignments(assignments as CanvasAssignment[], {
        showDueDate: true,
      });
      const rendered = logs.join("\n");

      expect(rendered).toContain("Assignment 1");
      expect(rendered).toContain("│");
      expect(rendered).toContain("╭");
      expect(rendered).toContain("╰");
    } finally {
      restoreLog();
    }
  });

  test("displayAssignments handles empty assignment list", () => {
    try {
      displayAssignments([], {});
      const rendered = logs.join("\n");

      // Empty table should still render borders
      expect(rendered).toContain("│");
    } finally {
      restoreLog();
    }
  });
});
