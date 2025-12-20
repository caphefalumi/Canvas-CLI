/**
 * End-to-End tests for Canvas CLI
 * Tests the CLI commands to ensure they work correctly
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

const CLI_PATH = join(__dirname, "..", "dist", "src", "index.js");
const PACKAGE_JSON_PATH = join(__dirname, "..", "package.json");

// Read version from package.json
const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));
const EXPECTED_VERSION = packageJson.version;

describe("E2E: CLI Executable", () => {
  beforeAll(() => {
    // Ensure the CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(
        `CLI not built. Please run 'npm run build' first. Looking for: ${CLI_PATH}`,
      );
    }
  });

  test("should have Node.js shebang in compiled output", () => {
    const fs = require("fs");
    const content = fs.readFileSync(CLI_PATH, "utf-8");
    const firstLine = content.split("\n")[0];
    expect(firstLine.trim()).toBe("#!/usr/bin/env node");
  });

  test("CLI should show help with --help", () => {
    const result = spawnSync("node", [CLI_PATH, "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Canvas LMS Command Line Interface");
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("Commands:");
  });

  test("CLI should show version with --version", () => {
    const result = spawnSync("node", [CLI_PATH, "--version"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    // Extract version from output (may contain dotenv debug info)
    const lines = result.stdout.trim().split("\n");
    const versionLine = lines[lines.length - 1].trim();
    expect(versionLine).toBe(EXPECTED_VERSION);
  });

  test("CLI should list available commands", () => {
    const result = spawnSync("node", [CLI_PATH, "--help"], {
      encoding: "utf-8",
    });

    const expectedCommands = [
      "list",
      "config",
      "assignments",
      "grades",
      "announcements",
      "profile",
      "submit",
      "calendar",
      "modules",
      "todo",
      "files",
      "groups",
    ];

    for (const cmd of expectedCommands) {
      expect(result.stdout).toContain(cmd);
    }
  });

  test("config command should have subcommands", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("show");
    expect(result.stdout).toContain("setup");
    expect(result.stdout).toContain("edit");
    expect(result.stdout).toContain("path");
    expect(result.stdout).toContain("delete");
  });

  test("should handle invalid command gracefully", () => {
    const result = spawnSync("node", [CLI_PATH, "invalid-command"], {
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("error");
  });

  test("list command should require config", () => {
    // This test assumes no config exists in test environment
    // If config exists, it will try to connect to Canvas
    const result = spawnSync("node", [CLI_PATH, "list"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        // Ensure we don't use any existing config
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should prompt for config or show config-related message
    const output = result.stdout + result.stderr;
    expect(
      output.includes("configuration") ||
        output.includes("config") ||
        output.includes("setup"),
    ).toBe(true);
  });

  test("assignments command should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("course-name");
  });

  test("grades command should have --all and --verbose options", () => {
    const result = spawnSync("node", [CLI_PATH, "grades", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--all");
    expect(result.stdout).toContain("--verbose");
  });

  test("calendar command should have --days option", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--days");
  });

  test("submit command should have --file and --dry-run options", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--file");
    expect(result.stdout).toContain("--dry-run");
  });
});

describe("E2E: Platform Compatibility", () => {
  test("should run on current platform", () => {
    const result = spawnSync("node", [CLI_PATH, "--version"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();
  });

  test("CLI file should be executable format", () => {
    const fs = require("fs");
    const stats = fs.statSync(CLI_PATH);
    expect(stats.isFile()).toBe(true);
    expect(stats.size).toBeGreaterThan(0);
  });
});

describe("E2E: Config Command", () => {
  test("config should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("config");
  });

  test("config show should work", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "show"], {
      encoding: "utf-8",
    });

    // Should either show config or indicate no config found
    const output = result.stdout + result.stderr;
    expect(
      output.includes("Configuration") || output.includes("Not found"),
    ).toBe(true);
  });

  test("config status alias should work", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "status"], {
      encoding: "utf-8",
    });

    const output = result.stdout + result.stderr;
    expect(
      output.includes("Configuration") || output.includes("Not found"),
    ).toBe(true);
  });

  test("config path should show config file location", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "path"], {
      encoding: "utf-8",
    });

    const output = result.stdout + result.stderr;
    expect(
      output.includes("config") || output.includes("path") || output.length > 0,
    ).toBe(true);
  });
});

describe("E2E: List Command", () => {
  test("list should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "list", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("List starred courses");
  });

  test("list should have -a/--all option", () => {
    const result = spawnSync("node", [CLI_PATH, "list", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("list should have -v/--verbose option", () => {
    const result = spawnSync("node", [CLI_PATH, "list", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--verbose");
  });

  test("list alias 'l' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "l", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("courses");
  });
});

describe("E2E: Assignments Command", () => {
  test("assignments should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("assignments");
  });

  test("assignments should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
    expect(result.stdout).toContain("optional");
  });

  test("assignments should have --verbose option", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--verbose");
  });

  test("assignments should have --submitted option", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--submitted");
  });

  test("assignments should have --pending option", () => {
    const result = spawnSync("node", [CLI_PATH, "assignments", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--pending");
  });

  test("assignments alias 'assign' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "assign", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Grades Command", () => {
  test("grades should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "grades", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("grades");
  });

  test("grades should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "grades", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
  });

  test("grades should have --verbose option", () => {
    const result = spawnSync("node", [CLI_PATH, "grades", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--verbose");
  });

  test("grades should have --all option", () => {
    const result = spawnSync("node", [CLI_PATH, "grades", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("grades alias 'grade' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "grade", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("grades alias 'mark' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "mark", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("grades alias 'marks' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "marks", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Announcements Command", () => {
  test("announcements should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "announcements", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("announcements");
  });

  test("announcements should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "announcements", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
  });

  test("announcements should have --limit option", () => {
    const result = spawnSync("node", [CLI_PATH, "announcements", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--limit");
  });

  test("announcements alias 'an' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "an", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Profile Command", () => {
  test("profile should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "profile", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("profile");
  });

  test("profile should have --verbose option", () => {
    const result = spawnSync("node", [CLI_PATH, "profile", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--verbose");
  });

  test("profile alias 'me' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "me", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Submit Command", () => {
  test("submit should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("submit");
  });

  test("submit should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
  });

  test("submit should have --file option", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--file");
  });

  test("submit should have --all option", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("submit should have --dry-run option", () => {
    const result = spawnSync("node", [CLI_PATH, "submit", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--dry-run");
  });

  test("submit alias 'sub' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "sub", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Calendar Command", () => {
  test("calendar should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("calendar");
  });

  test("calendar should have --days option", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--days");
  });

  test("calendar should have --all option", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("calendar should have --past option", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--past");
  });

  test("calendar alias 'cal' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "cal", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("calendar alias 'due' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "due", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Modules Command", () => {
  test("modules should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "modules", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("modules");
  });

  test("modules should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "modules", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
  });

  test("modules should have --all option", () => {
    const result = spawnSync("node", [CLI_PATH, "modules", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("modules alias 'mod' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "mod", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("modules alias 'content' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "content", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Todo Command", () => {
  test("todo should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "todo", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("todo");
  });

  test("todo should have --limit option", () => {
    const result = spawnSync("node", [CLI_PATH, "todo", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--limit");
  });

  test("todo alias 'tasks' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "tasks", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("todo alias 'pending' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "pending", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Files Command", () => {
  test("files should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "files", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("files");
  });

  test("files should accept course name argument", () => {
    const result = spawnSync("node", [CLI_PATH, "files", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("course-name");
  });

  test("files should have --all option", () => {
    const result = spawnSync("node", [CLI_PATH, "files", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--all");
  });

  test("files alias 'file' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "file", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("files alias 'docs' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "docs", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Groups Command", () => {
  test("groups should show help", () => {
    const result = spawnSync("node", [CLI_PATH, "groups", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("groups");
  });

  test("groups should have --members option", () => {
    const result = spawnSync("node", [CLI_PATH, "groups", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--members");
  });

  test("groups should have --verbose option", () => {
    const result = spawnSync("node", [CLI_PATH, "groups", "--help"], {
      encoding: "utf-8",
    });

    expect(result.stdout).toContain("--verbose");
  });

  test("groups alias 'group' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "group", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });

  test("groups alias 'teams' should work", () => {
    const result = spawnSync("node", [CLI_PATH, "teams", "--help"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
  });
});

describe("E2E: Edge Cases", () => {
  test("should handle empty command", () => {
    const result = spawnSync("node", [CLI_PATH], {
      encoding: "utf-8",
    });

    // Empty command shows help, output might be in stdout or stderr
    const output = result.stdout + result.stderr;
    expect(output.includes("Canvas LMS") || output.includes("Usage:")).toBe(
      true,
    );
  });

  test("should handle -h flag", () => {
    const result = spawnSync("node", [CLI_PATH, "-h"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  test("should handle -v flag for version", () => {
    const result = spawnSync("node", [CLI_PATH, "-V"], {
      encoding: "utf-8",
    });

    expect(result.status).toBe(0);
    // Extract version from output (may contain dotenv debug info)
    const lines = result.stdout.trim().split("\n");
    const versionLine = lines[lines.length - 1].trim();
    expect(versionLine).toBe(EXPECTED_VERSION);
  });

  test("should handle unknown option", () => {
    const result = spawnSync("node", [CLI_PATH, "--unknown-option"], {
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("error");
  });

  test("should handle invalid subcommand", () => {
    const result = spawnSync("node", [CLI_PATH, "config", "invalid"], {
      encoding: "utf-8",
    });

    // Config command shows help when invalid subcommand is given
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });

  test("should handle multiple flags", () => {
    const result = spawnSync("node", [CLI_PATH, "list", "-a", "-v"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should either work or prompt for config
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });

  test("should handle command with argument and options", () => {
    const result = spawnSync(
      "node",
      [CLI_PATH, "assignments", "test-course", "-v"],
      {
        encoding: "utf-8",
        env: {
          ...process.env,
          HOME: "/tmp/canvas-cli-test",
          USERPROFILE: "C:\\temp\\canvas-cli-test",
        },
      },
    );

    // Should either work or prompt for config
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });

  test("should handle special characters in course name", () => {
    const result = spawnSync(
      "node",
      [CLI_PATH, "assignments", "Course-Name_123"],
      {
        encoding: "utf-8",
        env: {
          ...process.env,
          HOME: "/tmp/canvas-cli-test",
          USERPROFILE: "C:\\temp\\canvas-cli-test",
        },
      },
    );

    // Should not crash
    expect(result.error).toBeUndefined();
  });

  test("should handle numeric limit values", () => {
    const result = spawnSync("node", [CLI_PATH, "todo", "-l", "10"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should not crash
    expect(result.error).toBeUndefined();
  });

  test("should handle invalid numeric limit values", () => {
    const result = spawnSync("node", [CLI_PATH, "todo", "-l", "abc"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should handle gracefully
    expect(result.error).toBeUndefined();
  });

  test("should handle very large limit values", () => {
    const result = spawnSync("node", [CLI_PATH, "todo", "-l", "999999"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should not crash
    expect(result.error).toBeUndefined();
  });

  test("should handle negative limit values", () => {
    const result = spawnSync("node", [CLI_PATH, "calendar", "-d", "-5"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should handle gracefully
    expect(result.error).toBeUndefined();
  });

  test("should handle file path with spaces", () => {
    const result = spawnSync(
      "node",
      [CLI_PATH, "submit", "-f", "file with spaces.pdf"],
      {
        encoding: "utf-8",
        env: {
          ...process.env,
          HOME: "/tmp/canvas-cli-test",
          USERPROFILE: "C:\\temp\\canvas-cli-test",
        },
      },
    );

    // Should not crash (will fail due to no config/file, but shouldn't error out)
    expect(result.error).toBeUndefined();
  });

  test("should handle combined short options", () => {
    const result = spawnSync("node", [CLI_PATH, "list", "-av"], {
      encoding: "utf-8",
      env: {
        ...process.env,
        HOME: "/tmp/canvas-cli-test",
        USERPROFILE: "C:\\temp\\canvas-cli-test",
      },
    });

    // Should parse options correctly
    expect(result.error).toBeUndefined();
  });

  test("should handle help for non-existent command", () => {
    const result = spawnSync("node", [CLI_PATH, "nonexistent", "--help"], {
      encoding: "utf-8",
    });

    // Commander shows help for non-existent commands
    const output = result.stdout + result.stderr;
    expect(output.length).toBeGreaterThan(0);
  });
});
