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

describe("Profile Display", () => {
  test("profile table renders field-value pairs", () => {
    const columns = [
      { key: "field", header: "Field", width: 20 },
      { key: "value", header: "Value", flex: 1, minWidth: 20 },
    ];

    const table = new Table(columns, {
      showRowNumbers: false,
      title: "User Profile",
    });
    table.addRow({ field: "Name", value: "John Doe" });
    table.addRow({ field: "Email", value: "john.doe@example.com" });
    table.addRow({ field: "Student ID", value: "12345678" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("User Profile");
      expect(rendered).toContain("Name");
      expect(rendered).toContain("John Doe");
      expect(rendered).toContain("Email");
      expect(rendered).toContain("john.doe@example.com");
    } finally {
      restoreLog();
    }
  });

  test("profile table handles long values", () => {
    const columns = [
      { key: "field", header: "Field", width: 15 },
      { key: "value", header: "Value", width: 30 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({
      field: "Bio",
      value:
        "This is a very long biography that exceeds the column width and should be truncated with ellipsis",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      // Value should be truncated
      expect(rendered).toContain("...");
    } finally {
      restoreLog();
    }
  });

  test("profile table with multiple fields renders correctly", () => {
    const columns = [
      { key: "field", header: "Property", width: 18 },
      { key: "value", header: "Value", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ field: "User ID", value: "98765" });
    table.addRow({ field: "Login", value: "student123" });
    table.addRow({ field: "Primary Email", value: "student@university.edu" });
    table.addRow({ field: "Locale", value: "en-US" });
    table.addRow({ field: "Time Zone", value: "America/Los_Angeles" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("User ID");
      expect(rendered).toContain("Login");
      expect(rendered).toContain("Primary Email");
      expect(rendered).toContain("Locale");
      expect(rendered).toContain("Time Zone");
    } finally {
      restoreLog();
    }
  });
});
