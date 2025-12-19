import { describe, test, expect, beforeEach } from "bun:test";
import { Table, truncate, pad } from "../lib/display";

let logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(" "));
});

function restoreLog() {
  console.log = originalLog;
}

function stripAnsi(str: string): string {
  return str.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

function getRenderedWidth(rendered: string): number {
  const lines = rendered.split("\n");
  const dataLine = lines.find((l) => l.includes("│") && !l.includes("═"));
  if (!dataLine) return 0;
  return stripAnsi(dataLine).length;
}

describe("Display - Narrow Terminal Tests", () => {
  test("table fits in 60-column terminal", () => {
    process.stdout.columns = 60;

    const columns = [
      { key: "name", header: "Assignment Name", flex: 1, minWidth: 10 },
      { key: "due", header: "Due Date", width: 15 },
    ];

    const table = new Table(columns, { showRowNumbers: true, truncate: true });
    table.addRow({
      name: "Very Long Assignment Name That Needs Truncation",
      due: "12/20/2025",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(60);
      expect(rendered).toContain("...");
    } finally {
      restoreLog();
    }
  });

  test("table fits in 50-column terminal", () => {
    process.stdout.columns = 50;

    const columns = [
      { key: "name", header: "Name", flex: 1 },
      { key: "status", header: "Status", width: 10 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ name: "Test Assignment", status: "Complete" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(50);
    } finally {
      restoreLog();
    }
  });

  test("table fits in 40-column terminal (minimum)", () => {
    process.stdout.columns = 40;

    const columns = [
      { key: "name", header: "Item", flex: 1 },
      { key: "value", header: "Val", width: 8 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ name: "Long item name", value: "12345" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(40);
    } finally {
      restoreLog();
    }
  });

  test("table with 4 columns fits in 80-column terminal", () => {
    process.stdout.columns = 80;

    const columns = [
      { key: "id", header: "ID", width: 5 },
      { key: "name", header: "Assignment Name", flex: 1, minWidth: 15 },
      { key: "type", header: "Type", width: 10 },
      { key: "status", header: "Status", width: 12 },
    ];

    const table = new Table(columns, { showRowNumbers: true });
    table.addRow({
      id: "1",
      name: "Week2: ACF Lab 3: Advanced Computer Forensics",
      type: "pdf",
      status: "✓ Submitted",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(80);
      expect(rendered).toContain("Week2");
    } finally {
      restoreLog();
    }
  });

  test("table with row numbers fits in narrow terminal", () => {
    process.stdout.columns = 55;

    const columns = [{ key: "name", header: "Course Name", flex: 1 }];

    const table = new Table(columns, { showRowNumbers: true });
    for (let i = 1; i <= 10; i++) {
      table.addRow({ name: `Course ${i} with a long name` });
    }

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(55);
      expect(rendered).toContain("10.");
    } finally {
      restoreLog();
    }
  });
});

describe("Display - Wide Terminal Tests", () => {
  test("table expands properly in wide terminal", () => {
    // Mock process.stdout.columns
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 150,
      writable: true,
      configurable: true,
    });

    // Verify the mock is working
    expect(process.stdout.columns).toBe(150);

    const columns = [
      { key: "name", header: "Assignment Name", flex: 1, minWidth: 20 },
      { key: "due", header: "Due Date", width: 20 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    // Add longer content that needs more space
    table.addRow({
      name: "This is a really long assignment name that needs lots of space to display properly",
      due: "12/20/2025",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      // With long content, the flex column should expand to fit it
      // Width should be much more than minimum (40+)
      expect(width).toBeGreaterThan(60);
      expect(rendered).toContain("really long assignment");
    } finally {
      // Restore original value
      Object.defineProperty(process.stdout, "columns", {
        value: originalColumns,
        writable: true,
        configurable: true,
      });
      restoreLog();
    }
  });

  test("flex columns distribute space in wide terminal", () => {
    // Mock process.stdout.columns
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 120,
      writable: true,
      configurable: true,
    });

    const columns = [
      { key: "col1", header: "Column 1", flex: 2, minWidth: 10 },
      { key: "col2", header: "Column 2", flex: 1, minWidth: 10 },
      { key: "col3", header: "Fixed", width: 15 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ col1: "Data 1", col2: "Data 2", col3: "Fixed Width" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("Column 1");
      expect(rendered).toContain("Column 2");
      expect(rendered).toContain("Fixed");
    } finally {
      // Restore original value
      Object.defineProperty(process.stdout, "columns", {
        value: originalColumns,
        writable: true,
        configurable: true,
      });
      restoreLog();
    }
  });
});

describe("Display - Edge Case Tests", () => {
  test("empty table renders correctly", () => {
    process.stdout.columns = 80;

    const columns = [{ key: "name", header: "Name", flex: 1 }];

    const table = new Table(columns, { showRowNumbers: false });

    try {
      table.render((str: string) => logs.push(str));
      const rendered = logs.join("\n");

      expect(rendered).toContain("Name");
      expect(rendered).toContain("╭");
      expect(rendered).toContain("╰");
    } finally {
      restoreLog();
    }
  });

  test("single row table", () => {
    process.stdout.columns = 70;

    const columns = [
      { key: "field", header: "Field", width: 15 },
      { key: "value", header: "Value", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ field: "Name", value: "John Doe" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(70);
      expect(rendered).toContain("John Doe");
    } finally {
      restoreLog();
    }
  });

  test("many rows table", () => {
    process.stdout.columns = 60;

    const columns = [{ key: "name", header: "Item", flex: 1, minWidth: 10 }];

    const table = new Table(columns, { showRowNumbers: true });
    for (let i = 1; i <= 50; i++) {
      table.addRow({ name: `Item ${i}` });
    }

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(60);
      expect(rendered).toContain("50.");
    } finally {
      restoreLog();
    }
  });

  test("very long cell content gets truncated", () => {
    process.stdout.columns = 60;

    const columns = [{ key: "text", header: "Text", width: 20 }];

    const table = new Table(columns, { showRowNumbers: false, truncate: true });
    table.addRow({
      text: "This is an extremely long text that definitely needs to be truncated because it exceeds the column width by a significant amount",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("...");

      // Extract cell content and verify it's truncated to exactly 20 chars
      const lines = stripAnsi(rendered).split("\n");
      const dataLine = lines.find((l) => l.includes("│") && l.includes("This"));
      if (dataLine) {
        const cell = dataLine.split("│")[1]?.trim() || "";
        expect(cell.length).toBeLessThanOrEqual(20);
      }
    } finally {
      restoreLog();
    }
  });

  test("unicode and emoji in cells", () => {
    process.stdout.columns = 70;

    const columns = [
      { key: "icon", header: "Icon", width: 5 },
      { key: "name", header: "Name", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ icon: "📄", name: "Document.pdf" });
    table.addRow({ icon: "📁", name: "Folder" });
    table.addRow({ icon: "✓", name: "Completed" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(70);
      expect(rendered).toContain("📄");
      expect(rendered).toContain("✓");
    } finally {
      restoreLog();
    }
  });

  test("mixed width columns in narrow terminal", () => {
    process.stdout.columns = 65;

    const columns = [
      { key: "id", header: "#", width: 3 },
      { key: "name", header: "Assignment Name", flex: 1, minWidth: 12 },
      { key: "type", header: "Type", width: 8 },
      { key: "date", header: "Due Date", width: 12 },
      { key: "status", header: "Status", width: 10 },
    ];

    const table = new Table(columns, { showRowNumbers: false, truncate: true });
    table.addRow({
      id: "1",
      name: "Week2: ACF Lab 3: Advanced Computer Forensics Laboratory Exercise",
      type: "pdf",
      date: "9/18/2025",
      status: "✓ Submit",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(65);
      expect(rendered).toContain("Week2");
      expect(rendered).toContain("...");
    } finally {
      restoreLog();
    }
  });

  test("table with title in narrow terminal", () => {
    process.stdout.columns = 50;

    const columns = [{ key: "name", header: "Name", flex: 1 }];

    const table = new Table(columns, {
      showRowNumbers: false,
      title: "My Table",
    });
    table.addRow({ name: "Test" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");
      const width = getRenderedWidth(rendered);

      expect(width).toBeLessThanOrEqual(50);
      expect(rendered).toContain("My Table");
    } finally {
      restoreLog();
    }
  });
});

describe("Display - Truncate Function Edge Cases", () => {
  test("truncate with exact length", () => {
    const result = truncate("Hello", 5);
    expect(result).toBe("Hello");
  });

  test("truncate with length 1", () => {
    const result = truncate("Hello", 1);
    expect(stripAnsi(result).length).toBeLessThanOrEqual(1);
  });

  test("truncate with length 2", () => {
    const result = truncate("Hello World", 2);
    expect(stripAnsi(result).length).toBeLessThanOrEqual(2);
  });

  test("truncate with length 3 (minimum for ellipsis)", () => {
    const result = truncate("Hello", 3);
    expect(stripAnsi(result).length).toBeLessThanOrEqual(3);
  });

  test("truncate preserves ANSI in short strings", () => {
    const colored = "\u001B[32mHi\u001B[0m";
    const result = truncate(colored, 5);
    expect(result).toBe(colored);
  });
});

describe("Display - Pad Function Edge Cases", () => {
  test("pad to exact length", () => {
    const result = pad("test", 4);
    expect(stripAnsi(result).length).toBe(4);
  });

  test("pad shorter string", () => {
    const result = pad("a", 10);
    expect(stripAnsi(result).length).toBe(10);
    expect(stripAnsi(result).trim()).toBe("a");
  });

  test("pad with center alignment odd difference", () => {
    const result = pad("test", 9, "center");
    const stripped = stripAnsi(result);
    expect(stripped.length).toBe(9);
    expect(stripped.trim()).toBe("test");
  });

  test("pad with right alignment", () => {
    const result = pad("test", 10, "right");
    const stripped = stripAnsi(result);
    expect(stripped.length).toBe(10);
    expect(stripped.endsWith("test")).toBe(true);
  });
});
