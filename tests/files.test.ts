/**
 * Unit tests for Files command
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

describe("Files Command - File Browser Display", () => {
  test("should display files with icons and sizes", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "File Name", flex: 1, minWidth: 25 },
      { key: "size", header: "Size", width: 10 },
      { key: "updated", header: "Updated", width: 12 },
    ];

    const table = new Table(columns, {
      showRowNumbers: true,
      title: "Course Files",
    });

    table.addRow({
      icon: "📄",
      name: "Syllabus.pdf",
      size: "245 KB",
      updated: "12/01/25",
    });

    table.addRow({
      icon: "📝",
      name: "Assignment1.docx",
      size: "1.2 MB",
      updated: "12/05/25",
    });

    table.addRow({
      icon: "📊",
      name: "Grades.xlsx",
      size: "89 KB",
      updated: "12/10/25",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Course Files");
      expect(rendered).toContain("📄");
      expect(rendered).toContain("Syllabus.pdf");
      expect(rendered).toContain("245 KB");
      expect(rendered).toContain("12/01/25");
    } finally {
      restoreLog();
    }
  });

  test("should display folders and files", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "Name", flex: 1 },
      { key: "type", header: "Type", width: 10 },
    ];

    const table = new Table(columns);

    table.addRow({
      icon: "📁",
      name: "Week 1",
      type: "Folder",
    });

    table.addRow({
      icon: "📁",
      name: "Week 2",
      type: "Folder",
    });

    table.addRow({
      icon: "📄",
      name: "Schedule.pdf",
      type: "File",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("📁");
      expect(rendered).toContain("Week 1");
      expect(rendered).toContain("Folder");
      expect(rendered).toContain("Schedule.pdf");
    } finally {
      restoreLog();
    }
  });

  test("should handle various file types with icons", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "File", flex: 1 },
    ];

    const table = new Table(columns);

    table.addRow({ icon: "📄", name: "document.pdf" });
    table.addRow({ icon: "📝", name: "essay.docx" });
    table.addRow({ icon: "📊", name: "data.xlsx" });
    table.addRow({ icon: "🖼️", name: "image.png" });
    table.addRow({ icon: "📹", name: "lecture.mp4" });
    table.addRow({ icon: "🎵", name: "audio.mp3" });
    table.addRow({ icon: "📦", name: "archive.zip" });
    table.addRow({ icon: "💻", name: "script.py" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("📄");
      expect(rendered).toContain("document.pdf");
      expect(rendered).toContain("💻");
      expect(rendered).toContain("script.py");
    } finally {
      restoreLog();
    }
  });

  test("should handle empty folder", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "Name", flex: 1 },
    ];

    const table = new Table(columns, { title: "Empty Folder" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Empty Folder");
      expect(rendered).toContain("Name");
    } finally {
      restoreLog();
    }
  });

  test("should display file sizes in different units", () => {
    const columns = [
      { key: "name", header: "File", flex: 1 },
      { key: "size", header: "Size", width: 10 },
    ];

    const table = new Table(columns);

    table.addRow({ name: "small.txt", size: "1.5 KB" });
    table.addRow({ name: "medium.pdf", size: "2.3 MB" });
    table.addRow({ name: "large.mp4", size: "1.2 GB" });
    table.addRow({ name: "tiny.json", size: "512 B" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("1.5 KB");
      expect(rendered).toContain("2.3 MB");
      expect(rendered).toContain("1.2 GB");
      expect(rendered).toContain("512 B");
    } finally {
      restoreLog();
    }
  });

  test("should handle long file names", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "File Name", flex: 1, minWidth: 30 },
      { key: "size", header: "Size", width: 10 },
    ];

    const table = new Table(columns);

    table.addRow({
      icon: "📄",
      name: "Very_Long_File_Name_With_Multiple_Words_And_Underscores_2025.pdf",
      size: "1.5 MB",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Very_Long");
      expect(rendered).toContain("1.5 MB");
    } finally {
      restoreLog();
    }
  });

  test("should display nested folder structure", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "Path", flex: 1 },
      { key: "files", header: "Files", width: 8 },
    ];

    const table = new Table(columns, { title: "Folder Structure" });

    table.addRow({
      icon: "📁",
      name: "Lectures/",
      files: "12",
    });

    table.addRow({
      icon: "📁",
      name: "Lectures/Week1/",
      files: "5",
    });

    table.addRow({
      icon: "📁",
      name: "Lectures/Week2/",
      files: "7",
    });

    table.addRow({
      icon: "📁",
      name: "Assignments/",
      files: "8",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Folder Structure");
      expect(rendered).toContain("Lectures/");
      expect(rendered).toContain("Week1/");
      expect(rendered).toContain("Assignments/");
    } finally {
      restoreLog();
    }
  });

  test("should handle special characters in file names", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "File", flex: 1 },
    ];

    const table = new Table(columns);

    table.addRow({ icon: "📄", name: "File (1).pdf" });
    table.addRow({ icon: "📄", name: "File [Draft].docx" });
    table.addRow({ icon: "📄", name: "File & Notes.txt" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("File (1).pdf");
      expect(rendered).toContain("File [Draft].docx");
      expect(rendered).toContain("File & Notes.txt");
    } finally {
      restoreLog();
    }
  });

  test("should display file modification dates", () => {
    const columns = [
      { key: "name", header: "File", flex: 1 },
      { key: "modified", header: "Modified", width: 20 },
    ];

    const table = new Table(columns);

    table.addRow({ name: "recent.pdf", modified: "12/15/25 3:45 PM" });
    table.addRow({ name: "older.docx", modified: "11/20/25 10:30 AM" });
    table.addRow({ name: "oldest.txt", modified: "09/05/25 2:15 PM" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("recent.pdf");
      expect(rendered).toContain("12/15/25");
      expect(rendered).toContain("11/20/25");
    } finally {
      restoreLog();
    }
  });

  test("should handle files with no extension", () => {
    const columns = [
      { key: "icon", header: "", width: 3 },
      { key: "name", header: "Name", flex: 1 },
    ];

    const table = new Table(columns);

    table.addRow({ icon: "📄", name: "README" });
    table.addRow({ icon: "📄", name: "LICENSE" });
    table.addRow({ icon: "📄", name: "Makefile" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("README");
      expect(rendered).toContain("LICENSE");
      expect(rendered).toContain("Makefile");
    } finally {
      restoreLog();
    }
  });
});
