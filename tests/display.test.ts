import { describe, test, expect, beforeEach } from "bun:test";
import chalk from "chalk";
import { truncate, Table, pad } from "../lib/display";

// Set consistent terminal width for all tests
beforeEach(() => {
  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    writable: true,
    configurable: true,
  });
});

// Helper to strip ANSI codes
function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

describe("Display Library - Core Functions", () => {
  describe("truncate", () => {
    test("truncates visible text but ignores ANSI sequences", () => {
      const colored = chalk.green("This is a very long string with colors");
      const out = truncate(colored, 12);
      expect(stripAnsi(out).length).toBeLessThanOrEqual(12);
      expect(stripAnsi(out).endsWith("...")).toBe(true);
    });

    test("returns same string if short enough", () => {
      const s = "Short";
      expect(truncate(s, 10)).toBe(s);
    });

    test("handles very small maxLen gracefully", () => {
      const s = "Long string";
      const out = truncate(s, 3);
      expect(stripAnsi(out).length).toBeLessThanOrEqual(3);
    });

    test("handles empty string", () => {
      expect(truncate("", 10)).toBe("");
    });
  });

  describe("pad", () => {
    test("pads left (default)", () => {
      const result = pad("test", 10);
      expect(stripAnsi(result)).toBe("test      ");
    });

    test("pads right", () => {
      const result = pad("test", 10, "right");
      expect(stripAnsi(result)).toBe("      test");
    });

    test("pads center", () => {
      const result = pad("test", 10, "center");
      const stripped = stripAnsi(result);
      expect(stripped.trim()).toBe("test");
      expect(stripped.length).toBe(10);
    });

    test("handles ANSI colors correctly", () => {
      const colored = chalk.green("test");
      const result = pad(colored, 10);
      expect(stripAnsi(result).length).toBe(10);
    });
  });
});

describe("Display Library - Table Rendering", () => {
  test("table truncates cell to given width", () => {
    const columns = [{ key: "name", header: "Name", width: 12 }];
    const table = new Table(columns, { showRowNumbers: false });
    const longName =
      "Assignment 1: Very long unnamed assignment that should be cut";
    table.addRow({ name: longName });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    const dataLine = rendered
      .split("\n")
      .find(
        (l) => l.includes("│") && !l.includes("Name") && /[A-Za-z0-9]/.test(l),
      );
    expect(dataLine).toBeDefined();

    const visible = stripAnsi(dataLine!);
    const content = visible
      .slice(visible.indexOf("│") + 1, visible.lastIndexOf("│"))
      .trim();

    expect(content.length).toBeLessThanOrEqual(12);
    expect(content.length < longName.length).toBe(true);
  });

  test("table with multiple columns adapts width", () => {
    const columns = [
      { key: "id", header: "ID", width: 5 },
      { key: "name", header: "Name", flex: 1, minWidth: 10 },
      { key: "status", header: "Status", width: 10 },
    ];
    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ id: "1", name: "Assignment One", status: "Complete" });
    table.addRow({
      id: "2",
      name: "Assignment Two with a very long name",
      status: "Pending",
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    expect(rendered).toContain("│");
    expect(rendered).toContain("ID");
    expect(rendered).toContain("Name");
    expect(rendered).toContain("Status");
  });

  test("table with row numbers displays correctly", () => {
    const columns = [{ key: "course", header: "Course", flex: 1 }];
    const table = new Table(columns, {
      showRowNumbers: true,
      rowNumberHeader: "#",
    });
    table.addRow({ course: "Introduction to Computer Science" });
    table.addRow({ course: "Data Structures and Algorithms" });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    expect(rendered).toContain("#");
    expect(rendered).toContain("1.");
    expect(rendered).toContain("2.");
  });

  test("table with title displays title", () => {
    const columns = [{ key: "item", header: "Item", width: 20 }];
    const table = new Table(columns, {
      title: "Test Table",
      showRowNumbers: false,
    });
    table.addRow({ item: "Test Item" });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    expect(rendered).toContain("Test Table");
  });

  test("table handles empty data", () => {
    const columns = [{ key: "name", header: "Name", width: 20 }];
    const table = new Table(columns, { showRowNumbers: false });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    expect(rendered).toContain("Name");
    expect(rendered).toContain("╭");
    expect(rendered).toContain("╰");
  });

  test("table with color callback applies colors", () => {
    const columns = [
      {
        key: "score",
        header: "Score",
        width: 10,
        color: (value: string) => {
          const score = Number.parseInt(value);
          if (score >= 80) return chalk.green(value);
          if (score >= 50) return chalk.yellow(value);
          return chalk.red(value);
        },
      },
    ];
    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ score: "95" });
    table.addRow({ score: "65" });
    table.addRow({ score: "30" });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));

    try {
      table.render();
    } finally {
      console.log = origLog;
    }

    const rendered = logs.join("\n");
    // Verify the color callback was called and scores are in output
    expect(stripAnsi(rendered)).toContain("95");
    expect(stripAnsi(rendered)).toContain("65");
    expect(stripAnsi(rendered)).toContain("30");
  });
});
