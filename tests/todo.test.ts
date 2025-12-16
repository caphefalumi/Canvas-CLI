/**
 * Unit tests for Todo command
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Table } from "../lib/display";

let logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(" "));
  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    writable: true,
    configurable: true,
  });
});

function restoreLog() {
  console.log = originalLog;
}

describe("Todo Command - Pending Items Display", () => {
  test("should display todo items with due dates", () => {
    const columns = [
      { key: "type", header: "Type", width: 12 },
      { key: "title", header: "Task", flex: 1, minWidth: 20 },
      { key: "course", header: "Course", width: 20 },
      { key: "due", header: "Due", width: 18 },
      { key: "points", header: "Points", width: 8 },
    ];

    const table = new Table(columns, {
      showRowNumbers: true,
      title: "Pending Items",
    });

    table.addRow({
      type: "Assignment",
      title: "Project Proposal",
      course: "Software Engineering",
      due: "Tomorrow",
      points: "100",
    });

    table.addRow({
      type: "Quiz",
      title: "Chapter 5 Quiz",
      course: "Database Systems",
      due: "3 days",
      points: "50",
    });

    table.addRow({
      type: "Assignment",
      title: "Lab Report",
      course: "Data Science",
      due: "7 days",
      points: "75",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Pending Items");
      expect(rendered).toContain("Assignment");
      expect(rendered).toContain("Quiz");
      expect(rendered).toContain("Project Proposal");
      expect(rendered).toContain("Tomorrow");
      expect(rendered).toContain("100");
    } finally {
      restoreLog();
    }
  });

  test("should display overdue items", () => {
    const columns = [
      { key: "type", header: "Type", width: 12 },
      { key: "title", header: "Task", flex: 1 },
      { key: "due", header: "Due", width: 18 },
    ];

    const table = new Table(columns);

    table.addRow({
      type: "Assignment",
      title: "Overdue Assignment",
      due: "2d overdue",
    });

    table.addRow({
      type: "Quiz",
      title: "Today (overdue)",
      due: "Today (overdue)",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Overdue Assignment");
      expect(rendered).toContain("overdue");
    } finally {
      restoreLog();
    }
  });

  test("should handle items with no due date", () => {
    const columns = [
      { key: "type", header: "Type", width: 12 },
      { key: "title", header: "Task", flex: 1 },
      { key: "due", header: "Due", width: 18 },
      { key: "points", header: "Points", width: 8 },
    ];

    const table = new Table(columns);

    table.addRow({
      type: "Assignment",
      title: "Optional Reading",
      due: "No due date",
      points: "0",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Optional Reading");
      expect(rendered).toContain("No due date");
    } finally {
      restoreLog();
    }
  });

  test("should handle empty todo list", () => {
    const columns = [
      { key: "type", header: "Type", width: 12 },
      { key: "title", header: "Task", flex: 1 },
    ];

    const table = new Table(columns, { title: "Pending Items" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Pending Items");
      // Empty table should still render header
      expect(rendered).toContain("Type");
      expect(rendered).toContain("Task");
    } finally {
      restoreLog();
    }
  });

  test("should handle urgent items (< 1 hour)", () => {
    const columns = [
      { key: "title", header: "Task", flex: 1 },
      { key: "due", header: "Due", width: 18 },
    ];

    const table = new Table(columns);

    table.addRow({
      title: "Urgent Quiz",
      due: "< 1 hour",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Urgent Quiz");
      expect(rendered).toContain("< 1 hour");
    } finally {
      restoreLog();
    }
  });

  test("should display multiple assignments from same course", () => {
    const columns = [
      { key: "title", header: "Task", flex: 1 },
      { key: "course", header: "Course", width: 20 },
      { key: "points", header: "Points", width: 8 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    table.addRow({
      title: "Assignment 1",
      course: "Web Development",
      points: "100",
    });

    table.addRow({
      title: "Assignment 2",
      course: "Web Development",
      points: "100",
    });

    table.addRow({
      title: "Final Project",
      course: "Web Development",
      points: "200",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Assignment 1");
      expect(rendered).toContain("Assignment 2");
      expect(rendered).toContain("Final Project");
      expect(rendered).toContain("Web Development");
    } finally {
      restoreLog();
    }
  });

  test("should handle long task names", () => {
    const columns = [
      { key: "type", header: "Type", width: 12 },
      { key: "title", header: "Task", flex: 1, minWidth: 30 },
      { key: "due", header: "Due", width: 15 },
    ];

    const table = new Table(columns);

    table.addRow({
      type: "Assignment",
      title:
        "Complete Comprehensive Final Project Report with Full Documentation",
      due: "5 days",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Assignment");
      expect(rendered).toContain("Complete");
    } finally {
      restoreLog();
    }
  });

  test("should handle zero points assignments", () => {
    const columns = [
      { key: "title", header: "Task", flex: 1 },
      { key: "points", header: "Points", width: 8 },
    ];

    const table = new Table(columns);

    table.addRow({
      title: "Practice Exercise",
      points: "0",
    });

    table.addRow({
      title: "Graded Assignment",
      points: "100",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Practice Exercise");
      expect(rendered).toContain("Graded Assignment");
    } finally {
      restoreLog();
    }
  });
});
