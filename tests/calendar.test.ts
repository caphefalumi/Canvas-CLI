import { describe, test, expect, beforeEach } from "bun:test";
import { Table } from "../lib/display";

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
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

describe("Calendar - formatTimeRemaining", () => {
  function formatTimeRemaining(dueDate: Date): {
    text: string;
    urgency: string;
  } {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) {
      const pastDays = Math.abs(days);
      if (pastDays === 0) return { text: "Today", urgency: "overdue" };
      if (pastDays === 1) return { text: "1d ago", urgency: "overdue" };
      return { text: `${pastDays}d ago`, urgency: "overdue" };
    }

    if (days === 0) {
      if (hours <= 1) return { text: "< 1 hour", urgency: "critical" };
      return { text: `${hours} hours`, urgency: "critical" };
    }
    if (days === 1) return { text: "Tomorrow", urgency: "urgent" };
    if (days <= 3) return { text: `${days} days`, urgency: "urgent" };
    if (days <= 7) return { text: `${days} days`, urgency: "soon" };
    return { text: `${days} days`, urgency: "normal" };
  }

  test("shows overdue status for past due today", () => {
    const pastToday = new Date();
    pastToday.setHours(pastToday.getHours() - 2);
    const result = formatTimeRemaining(pastToday);
    expect(result.urgency).toBe("overdue");
    expect(result.text).toMatch(/Today|1d ago/);
  });

  test("shows overdue status for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    const result = formatTimeRemaining(yesterday);
    expect(result.urgency).toBe("overdue");
    expect(result.text).toMatch(/d ago/);
  });

  test("shows 'Xd ago' for multiple days past", () => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const result = formatTimeRemaining(fiveDaysAgo);
    expect(result.text).toContain("d ago");
    expect(result.urgency).toBe("overdue");
  });

  test("shows '< 1 hour' for imminent deadline", () => {
    const soon = new Date();
    soon.setMinutes(soon.getMinutes() + 30);
    const result = formatTimeRemaining(soon);
    expect(result.text).toBe("< 1 hour");
    expect(result.urgency).toBe("critical");
  });

  test("shows hours for same-day deadline", () => {
    const laterToday = new Date();
    laterToday.setHours(laterToday.getHours() + 5);
    const result = formatTimeRemaining(laterToday);
    expect(result.text).toContain("hours");
    expect(result.urgency).toBe("critical");
  });

  test("shows 'Tomorrow' for next day", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(tomorrow.getHours() + 2);
    const result = formatTimeRemaining(tomorrow);
    expect(result.text).toBe("Tomorrow");
    expect(result.urgency).toBe("urgent");
  });

  test("shows days for 2-3 day deadline", () => {
    const twoDays = new Date();
    twoDays.setDate(twoDays.getDate() + 2);
    const result = formatTimeRemaining(twoDays);
    expect(result.text).toBe("2 days");
    expect(result.urgency).toBe("urgent");
  });

  test("shows days for 4-7 day deadline", () => {
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    const result = formatTimeRemaining(fiveDays);
    expect(result.text).toBe("5 days");
    expect(result.urgency).toBe("soon");
  });

  test("shows days for >7 day deadline", () => {
    const twoWeeks = new Date();
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    const result = formatTimeRemaining(twoWeeks);
    expect(result.text).toBe("14 days");
    expect(result.urgency).toBe("normal");
  });
});

describe("Calendar - formatDueDate", () => {
  function formatDueDate(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const mins = date.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${hours}:${mins}`;
  }

  test("formats date correctly", () => {
    const date = new Date(2025, 11, 25, 14, 30);
    expect(formatDueDate(date)).toBe("12/25 14:30");
  });

  test("pads single digit month and day", () => {
    const date = new Date(2025, 0, 5, 9, 5);
    expect(formatDueDate(date)).toBe("01/05 09:05");
  });

  test("handles midnight", () => {
    const date = new Date(2025, 5, 15, 0, 0);
    expect(formatDueDate(date)).toBe("06/15 00:00");
  });

  test("handles 23:59", () => {
    const date = new Date(2025, 8, 30, 23, 59);
    expect(formatDueDate(date)).toBe("09/30 23:59");
  });
});

describe("Calendar - Table Display", () => {
  test("calendar table with due dates renders correctly", () => {
    const columns = [
      { key: "course", header: "Course", flex: 1, minWidth: 10 },
      { key: "assignment", header: "Assignment", flex: 1, minWidth: 15 },
      { key: "due", header: "Due", width: 12 },
      { key: "remaining", header: "Remaining", width: 10 },
      { key: "status", header: "Status", width: 8 },
    ];

    const table = new Table(columns, { showRowNumbers: true });
    table.addRow({
      course: "Database Systems",
      assignment: "Assignment 1",
      due: "12/20 23:59",
      remaining: "2 days",
      status: "Pending",
    });
    table.addRow({
      course: "Web Dev",
      assignment: "Project Milestone",
      due: "12/22 14:00",
      remaining: "4 days",
      status: "Done",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Database");
      expect(rendered).toContain("Assignment");
      expect(rendered).toContain("12/20");
      expect(rendered).toContain("Pending");
    } finally {
      restoreLog();
    }
  });

  test("calendar table handles many assignments", () => {
    const columns = [
      { key: "course", header: "Course", width: 15 },
      { key: "assignment", header: "Assignment", flex: 1 },
      { key: "due", header: "Due", width: 12 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    for (let i = 1; i <= 10; i++) {
      table.addRow({
        course: `Course ${i}`,
        assignment: `Assignment ${i}`,
        due: `12/${10 + i} 23:59`,
      });
    }

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Course 1");
      expect(rendered).toContain("Course 10");
      expect(rendered).toContain("Assignment");
    } finally {
      restoreLog();
    }
  });

  test("calendar table with long course names truncates", () => {
    const columns = [
      { key: "course", header: "Course", width: 20 },
      { key: "assignment", header: "Assignment", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({
      course: "Introduction to Advanced Database Systems and Cloud Computing",
      assignment: "Final Project",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("...");
      expect(rendered).toContain("Final Project");
    } finally {
      restoreLog();
    }
  });

  test("empty calendar displays correctly", () => {
    const columns = [
      { key: "course", header: "Course", flex: 1 },
      { key: "assignment", header: "Assignment", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Course");
      expect(rendered).toContain("Assignment");
      expect(rendered).toContain("│");
    } finally {
      restoreLog();
    }
  });
});

describe("Calendar - DueItem sorting", () => {
  test("due items sort by date ascending", () => {
    interface DueItem {
      name: string;
      dueAt: Date;
    }

    const items: DueItem[] = [
      { name: "Late", dueAt: new Date("2025-12-25") },
      { name: "Early", dueAt: new Date("2025-12-15") },
      { name: "Middle", dueAt: new Date("2025-12-20") },
    ];

    items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    expect(items[0].name).toBe("Early");
    expect(items[1].name).toBe("Middle");
    expect(items[2].name).toBe("Late");
  });

  test("due items with same date maintain order", () => {
    interface DueItem {
      name: string;
      dueAt: Date;
    }

    const sameDate = new Date("2025-12-20T23:59:00");
    const items: DueItem[] = [
      { name: "First", dueAt: new Date(sameDate) },
      { name: "Second", dueAt: new Date(sameDate) },
      { name: "Third", dueAt: new Date(sameDate) },
    ];

    items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    expect(items[0].name).toBe("First");
    expect(items[1].name).toBe("Second");
    expect(items[2].name).toBe("Third");
  });
});

describe("Calendar - Date filtering", () => {
  test("filters assignments within date range", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const assignments = [
      { name: "Past", dueAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      { name: "Today", dueAt: new Date(now.getTime() + 60 * 60 * 1000) },
      {
        name: "Next Week",
        dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        name: "Too Far",
        dueAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    ];

    const filtered = assignments.filter(
      (a) => a.dueAt >= now && a.dueAt <= futureDate,
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map((f) => f.name)).toContain("Today");
    expect(filtered.map((f) => f.name)).toContain("Next Week");
    expect(filtered.map((f) => f.name)).not.toContain("Past");
    expect(filtered.map((f) => f.name)).not.toContain("Too Far");
  });

  test("includes past assignments when showPast is true", () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const assignments = [
      {
        name: "Recent Past",
        dueAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        name: "Old Past",
        dueAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        name: "Future",
        dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
    ];

    const filtered = assignments.filter(
      (a) => a.dueAt >= pastDate && a.dueAt <= futureDate,
    );

    expect(filtered.length).toBe(2);
    expect(filtered.map((f) => f.name)).toContain("Recent Past");
    expect(filtered.map((f) => f.name)).toContain("Future");
    expect(filtered.map((f) => f.name)).not.toContain("Old Past");
  });
});

describe("Calendar - Status counts", () => {
  test("counts pending and submitted correctly", () => {
    const items = [
      { name: "A1", submitted: true },
      { name: "A2", submitted: false },
      { name: "A3", submitted: true },
      { name: "A4", submitted: false },
      { name: "A5", submitted: false },
    ];

    const pending = items.filter((d) => !d.submitted).length;
    const done = items.filter((d) => d.submitted).length;

    expect(pending).toBe(3);
    expect(done).toBe(2);
  });

  test("handles all submitted", () => {
    const items = [
      { name: "A1", submitted: true },
      { name: "A2", submitted: true },
    ];

    const pending = items.filter((d) => !d.submitted).length;
    const done = items.filter((d) => d.submitted).length;

    expect(pending).toBe(0);
    expect(done).toBe(2);
  });

  test("handles none submitted", () => {
    const items = [
      { name: "A1", submitted: false },
      { name: "A2", submitted: false },
    ];

    const pending = items.filter((d) => !d.submitted).length;
    const done = items.filter((d) => d.submitted).length;

    expect(pending).toBe(2);
    expect(done).toBe(0);
  });
});
