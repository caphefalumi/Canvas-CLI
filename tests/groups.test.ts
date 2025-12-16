/**
 * Unit tests for Groups command
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

describe("Groups Command - Group Memberships Display", () => {
  test("should display course groups", () => {
    const columns = [
      { key: "name", header: "Group Name", flex: 1, minWidth: 25 },
      { key: "course", header: "Course", width: 25 },
      { key: "members", header: "Members", width: 12 },
      { key: "role", header: "Role", width: 12 },
    ];

    const table = new Table(columns, {
      showRowNumbers: true,
      title: "Course Groups",
    });

    table.addRow({
      name: "Team Alpha",
      course: "Software Engineering",
      members: "5 members",
      role: "Member",
    });

    table.addRow({
      name: "Project Group 1",
      course: "Database Systems",
      members: "4 members",
      role: "Leader",
    });

    table.addRow({
      name: "Lab Group B",
      course: "Web Development",
      members: "6 members",
      role: "Member",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Course Groups");
      expect(rendered).toContain("Team Alpha");
      expect(rendered).toContain("Software Engineering");
      expect(rendered).toContain("5 members");
      expect(rendered).toContain("Leader");
    } finally {
      restoreLog();
    }
  });

  test("should display group member details", () => {
    const columns = [
      { key: "name", header: "Name", flex: 1, minWidth: 20 },
      { key: "email", header: "Email", width: 30 },
      { key: "role", header: "Role", width: 12 },
    ];

    const table = new Table(columns, { title: "Group Members - Team Alpha" });

    table.addRow({
      name: "John Smith",
      email: "john.smith@university.edu",
      role: "Leader",
    });

    table.addRow({
      name: "Jane Doe",
      email: "jane.doe@university.edu",
      role: "Member",
    });

    table.addRow({
      name: "Bob Johnson",
      email: "bob.johnson@university.edu",
      role: "Member",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Group Members - Team Alpha");
      expect(rendered).toContain("John Smith");
      expect(rendered).toContain("jane.doe@university.edu");
      expect(rendered).toContain("Leader");
    } finally {
      restoreLog();
    }
  });

  test("should handle groups with different member counts", () => {
    const columns = [
      { key: "name", header: "Group", flex: 1 },
      { key: "members", header: "Members", width: 12 },
    ];

    const table = new Table(columns);

    table.addRow({ name: "Solo Group", members: "1 member" });
    table.addRow({ name: "Small Group", members: "3 members" });
    table.addRow({ name: "Large Group", members: "12 members" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("1 member");
      expect(rendered).toContain("3 members");
      expect(rendered).toContain("12 members");
    } finally {
      restoreLog();
    }
  });

  test("should display account-level groups", () => {
    const columns = [
      { key: "name", header: "Group Name", flex: 1 },
      { key: "type", header: "Type", width: 15 },
      { key: "members", header: "Members", width: 12 },
    ];

    const table = new Table(columns, { title: "Other Groups" });

    table.addRow({
      name: "Student Council",
      type: "Account",
      members: "15 members",
    });

    table.addRow({
      name: "Tech Club",
      type: "Account",
      members: "23 members",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Other Groups");
      expect(rendered).toContain("Student Council");
      expect(rendered).toContain("Account");
      expect(rendered).toContain("15 members");
    } finally {
      restoreLog();
    }
  });

  test("should handle empty groups list", () => {
    const columns = [
      { key: "name", header: "Group Name", flex: 1 },
      { key: "members", header: "Members", width: 12 },
    ];

    const table = new Table(columns, { title: "Your Groups" });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Your Groups");
      expect(rendered).toContain("Group Name");
    } finally {
      restoreLog();
    }
  });

  test("should display group with join level and status", () => {
    const columns = [
      { key: "name", header: "Group", flex: 1 },
      { key: "join", header: "Join Level", width: 15 },
      { key: "status", header: "Status", width: 12 },
    ];

    const table = new Table(columns);

    table.addRow({
      name: "Open Group",
      join: "Open",
      status: "Active",
    });

    table.addRow({
      name: "Invitation Only",
      join: "Invitation",
      status: "Active",
    });

    table.addRow({
      name: "Closed Group",
      join: "Request",
      status: "Inactive",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Open Group");
      expect(rendered).toContain("Open");
      expect(rendered).toContain("Invitation");
      expect(rendered).toContain("Active");
    } finally {
      restoreLog();
    }
  });

  test("should handle long group names", () => {
    const columns = [
      { key: "name", header: "Group Name", flex: 1, minWidth: 30 },
      { key: "members", header: "Members", width: 12 },
    ];

    const table = new Table(columns);

    table.addRow({
      name: "Advanced Machine Learning Research and Development Team Group",
      members: "8 members",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Advanced");
      expect(rendered).toContain("8 members");
    } finally {
      restoreLog();
    }
  });

  test("should display group description", () => {
    const columns = [
      { key: "name", header: "Group", width: 20 },
      { key: "description", header: "Description", flex: 1 },
    ];

    const table = new Table(columns);

    table.addRow({
      name: "Study Group A",
      description: "Weekly study sessions for final exams",
    });

    table.addRow({
      name: "Project Team",
      description: "Collaborative software development project",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Study Group A");
      expect(rendered).toContain("Weekly study sessions");
      expect(rendered).toContain("Collaborative software");
    } finally {
      restoreLog();
    }
  });

  test("should handle groups from multiple courses", () => {
    const columns = [
      { key: "group", header: "Group", width: 20 },
      { key: "course", header: "Course", flex: 1 },
      { key: "members", header: "Members", width: 10 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    table.addRow({
      group: "Team 1",
      course: "Software Engineering",
      members: "5",
    });

    table.addRow({
      group: "Team 2",
      course: "Software Engineering",
      members: "5",
    });

    table.addRow({
      group: "Lab A",
      course: "Database Systems",
      members: "4",
    });

    table.addRow({
      group: "Lab B",
      course: "Database Systems",
      members: "4",
    });

    table.addRow({
      group: "Group Alpha",
      course: "Web Development",
      members: "6",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Team 1");
      expect(rendered).toContain("Team 2");
      expect(rendered).toContain("Software Engineering");
      expect(rendered).toContain("Database Systems");
      expect(rendered).toContain("Web Development");
    } finally {
      restoreLog();
    }
  });

  test("should display group leader information", () => {
    const columns = [
      { key: "group", header: "Group", flex: 1 },
      { key: "leader", header: "Leader", width: 20 },
      { key: "role", header: "Your Role", width: 12 },
    ];

    const table = new Table(columns);

    table.addRow({
      group: "Team Alpha",
      leader: "John Smith",
      role: "Leader",
    });

    table.addRow({
      group: "Team Beta",
      leader: "Jane Doe",
      role: "Member",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Team Alpha");
      expect(rendered).toContain("John Smith");
      expect(rendered).toContain("Leader");
      expect(rendered).toContain("Member");
    } finally {
      restoreLog();
    }
  });

  test("should handle special characters in group names", () => {
    const columns = [
      { key: "name", header: "Group", flex: 1 },
      { key: "members", header: "Members", width: 10 },
    ];

    const table = new Table(columns);

    table.addRow({
      name: "Team A & B",
      members: "8",
    });

    table.addRow({
      name: "Group (Fall 2025)",
      members: "6",
    });

    table.addRow({
      name: "Project #1",
      members: "5",
    });

    try {
      table.render();
      const rendered = logs.join("\n");

      expect(rendered).toContain("Team A & B");
      expect(rendered).toContain("Group (Fall 2025)");
      expect(rendered).toContain("Project #1");
    } finally {
      restoreLog();
    }
  });
});
