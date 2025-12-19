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

describe("Submit Command - File Summary Table", () => {
  test("file summary table displays selected files", () => {
    const columns = [
      { key: "filename", header: "File", flex: 1, minWidth: 20 },
      { key: "size", header: "Size", width: 12 },
    ];

    const table = new Table(columns, {
      showRowNumbers: true,
      title: "Selected Files",
    });
    table.addRow({ filename: "assignment1.pdf", size: "2.5 MB" });
    table.addRow({ filename: "screenshot.png", size: "1.2 MB" });
    table.addRow({
      filename: "code_submission_with_a_very_long_filename.zip",
      size: "15.8 MB",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("Selected Files");
      expect(rendered).toContain("assignment1.pdf");
      expect(rendered).toContain("2.5 MB");
      expect(rendered).toContain("#");
      expect(rendered).toContain("1.");
    } finally {
      restoreLog();
    }
  });

  test("submission summary table shows assignment details", () => {
    const columns = [
      { key: "field", header: "Field", width: 18 },
      { key: "value", header: "Value", flex: 1 },
    ];

    const table = new Table(columns, {
      showRowNumbers: false,
      title: "Submission Summary",
    });
    table.addRow({ field: "Assignment", value: "Project 1: Web Development" });
    table.addRow({
      field: "Course",
      value: "CS 101 - Introduction to Programming",
    });
    table.addRow({ field: "Due Date", value: "2025-12-20 11:59 PM" });
    table.addRow({ field: "Files", value: "3 file(s)" });
    table.addRow({
      field: "Mode",
      value: "DRY RUN - No files will be uploaded",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("Submission Summary");
      expect(rendered).toContain("Assignment");
      expect(rendered).toContain("Project 1");
      expect(rendered).toContain("DRY RUN");
    } finally {
      restoreLog();
    }
  });

  test("file browser table with extensions filter hint", () => {
    const columns = [
      { key: "name", header: "File/Folder", flex: 1, minWidth: 25 },
      { key: "size", header: "Size", width: 10 },
    ];

    const table = new Table(columns, {
      showRowNumbers: true,
      title: "Select Files (Allowed: .pdf, .docx, .zip)",
    });
    table.addRow({ name: "📁 documents/", size: "-" });
    table.addRow({ name: "📄 report.pdf", size: "3.2 MB" });
    table.addRow({ name: "📄 notes.docx", size: "145 KB" });
    table.addRow({ name: "📄 code.zip", size: "8.5 MB" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("Allowed");
      expect(rendered).toContain(".pdf");
      expect(rendered).toContain("📁");
      expect(rendered).toContain("📄");
    } finally {
      restoreLog();
    }
  });

  test("submission result table shows upload status", () => {
    const columns = [
      { key: "file", header: "File", flex: 1, minWidth: 20 },
      { key: "status", header: "Status", width: 12 },
    ];

    const table = new Table(columns, {
      showRowNumbers: false,
      title: "✓ Submission Complete",
    });
    table.addRow({ file: "assignment1.pdf", status: "✓ Uploaded" });
    table.addRow({ file: "code.zip", status: "✓ Uploaded" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("Submission Complete");
      expect(rendered).toContain("✓ Uploaded");
    } finally {
      restoreLog();
    }
  });
});

describe("Submit Command - Edge Cases", () => {
  test("handles single file submission", () => {
    const columns = [
      { key: "filename", header: "File", flex: 1 },
      { key: "size", header: "Size", width: 10 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({ filename: "single_file.pdf", size: "1.5 MB" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      expect(rendered).toContain("single_file.pdf");
      expect(rendered).toContain("1.5 MB");
    } finally {
      restoreLog();
    }
  });

  test("handles very long filenames with truncation", () => {
    const columns = [
      { key: "filename", header: "File", width: 25 },
      { key: "size", header: "Size", width: 10 },
    ];

    const table = new Table(columns, { showRowNumbers: false });
    table.addRow({
      filename:
        "this_is_an_extremely_long_filename_that_definitely_exceeds_the_column_width_and_needs_truncation.pdf",
      size: "5.0 MB",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = logs.join("\n");

      // Should contain ellipsis due to truncation
      expect(rendered).toContain("...");
    } finally {
      restoreLog();
    }
  });
});
