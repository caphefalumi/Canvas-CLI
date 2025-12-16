/**
 * Unit tests for Config library
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getDefaultConfig,
  saveConfig,
  configExists,
  getConfigPath,
  deleteConfig,
  readConfig,
} from "../lib/config";

const TEST_CONFIG_PATH = path.join(os.homedir(), ".canvaslms-cli-config.json");
let originalConfigContent: string | null = null;
let hadOriginalConfig = false;

beforeEach(() => {
  // Backup existing config if it exists
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    hadOriginalConfig = true;
    originalConfigContent = fs.readFileSync(TEST_CONFIG_PATH, "utf8");
  }
  // Clean up any existing test config
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.unlinkSync(TEST_CONFIG_PATH);
  }
});

afterEach(() => {
  // Clean up test config
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.unlinkSync(TEST_CONFIG_PATH);
  }
  // Restore original config if it existed
  if (hadOriginalConfig && originalConfigContent) {
    fs.writeFileSync(TEST_CONFIG_PATH, originalConfigContent, "utf8");
  }
  hadOriginalConfig = false;
  originalConfigContent = null;
});

describe("Config Library - Default Config", () => {
  test("getDefaultConfig returns proper structure", () => {
    const config = getDefaultConfig();

    expect(config).toHaveProperty("domain");
    expect(config).toHaveProperty("token");
    expect(config).toHaveProperty("createdAt");
    expect(config).toHaveProperty("lastUpdated");
    expect(config.domain).toBe("");
    expect(config.token).toBe("");
  });

  test("getDefaultConfig creates valid ISO dates", () => {
    const config = getDefaultConfig();

    expect(config.createdAt).toBeDefined();
    expect(config.lastUpdated).toBeDefined();
    expect(() => new Date(config.createdAt!)).not.toThrow();
    expect(() => new Date(config.lastUpdated!)).not.toThrow();
    expect(new Date(config.createdAt!).toISOString()).toBe(config.createdAt!);
    expect(new Date(config.lastUpdated!).toISOString()).toBe(
      config.lastUpdated!,
    );
  });
});

describe("Config Library - Config Path", () => {
  test("getConfigPath returns correct path", () => {
    const configPath = getConfigPath();

    expect(configPath).toContain(os.homedir());
    expect(configPath).toContain(".canvaslms-cli-config.json");
  });

  test("getConfigPath is absolute path", () => {
    const configPath = getConfigPath();

    expect(path.isAbsolute(configPath)).toBe(true);
  });
});

describe("Config Library - Config Existence", () => {
  test("configExists returns false when no config", () => {
    expect(configExists()).toBe(false);
  });

  test("configExists returns true after saving config", () => {
    saveConfig("test.instructure.com", "test-token-123");

    expect(configExists()).toBe(true);
  });

  test("configExists returns false after deleting config", () => {
    saveConfig("test.instructure.com", "test-token-123");
    deleteConfig();

    expect(configExists()).toBe(false);
  });
});

describe("Config Library - Save Config", () => {
  test("saveConfig creates config file", () => {
    const result = saveConfig("test.instructure.com", "test-token-123");

    expect(result).toBe(true);
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  test("saveConfig saves correct domain and token", () => {
    saveConfig("school.instructure.com", "my-secret-token");

    const saved = readConfig();
    expect(saved).not.toBeNull();
    expect(saved?.domain).toBe("school.instructure.com");
    expect(saved?.token).toBe("my-secret-token");
  });

  test("saveConfig strips https:// from domain", () => {
    saveConfig("https://school.instructure.com", "token");

    const saved = readConfig();
    expect(saved?.domain).toBe("school.instructure.com");
  });

  test("saveConfig strips http:// from domain", () => {
    saveConfig("http://school.instructure.com", "token");

    const saved = readConfig();
    expect(saved?.domain).toBe("school.instructure.com");
  });

  test("saveConfig strips trailing slash from domain", () => {
    saveConfig("school.instructure.com/", "token");

    const saved = readConfig();
    expect(saved?.domain).toBe("school.instructure.com");
  });

  test("saveConfig strips both protocol and trailing slash", () => {
    saveConfig("https://school.instructure.com/", "token");

    const saved = readConfig();
    expect(saved?.domain).toBe("school.instructure.com");
  });

  test("saveConfig includes timestamps", () => {
    saveConfig("test.instructure.com", "token");

    const saved = readConfig();
    expect(saved).toHaveProperty("createdAt");
    expect(saved).toHaveProperty("lastUpdated");
    expect(saved?.createdAt).toBeDefined();
    expect(saved?.lastUpdated).toBeDefined();
    expect(new Date(saved!.createdAt!).getTime()).toBeGreaterThan(0);
    expect(new Date(saved!.lastUpdated!).getTime()).toBeGreaterThan(0);
  });

  test("saveConfig creates valid JSON", () => {
    saveConfig("test.instructure.com", "token");

    const content = fs.readFileSync(TEST_CONFIG_PATH, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("saveConfig overwrites existing config", () => {
    saveConfig("first.instructure.com", "token1");
    saveConfig("second.instructure.com", "token2");

    const saved = readConfig();
    expect(saved?.domain).toBe("second.instructure.com");
    expect(saved?.token).toBe("token2");
  });
});

describe("Config Library - Read Config", () => {
  test("readConfig returns null when no config exists", () => {
    const config = readConfig();

    expect(config).toBeNull();
  });

  test("readConfig returns saved config", () => {
    saveConfig("test.instructure.com", "test-token");

    const config = readConfig();
    expect(config).not.toBeNull();
    expect(config?.domain).toBe("test.instructure.com");
    expect(config?.token).toBe("test-token");
  });

  test("readConfig includes all fields", () => {
    saveConfig("test.instructure.com", "token");

    const config = readConfig();
    expect(config).toHaveProperty("domain");
    expect(config).toHaveProperty("token");
    expect(config).toHaveProperty("createdAt");
    expect(config).toHaveProperty("lastUpdated");
  });
});

describe("Config Library - Delete Config", () => {
  test("deleteConfig returns false when no config exists", () => {
    const result = deleteConfig();

    expect(result).toBe(false);
  });

  test("deleteConfig returns true when config exists", () => {
    saveConfig("test.instructure.com", "token");

    const result = deleteConfig();
    expect(result).toBe(true);
  });

  test("deleteConfig removes config file", () => {
    saveConfig("test.instructure.com", "token");
    deleteConfig();

    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(false);
  });

  test("deleteConfig can be called multiple times", () => {
    saveConfig("test.instructure.com", "token");

    const result1 = deleteConfig();
    const result2 = deleteConfig();

    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });
});

describe("Config Library - Edge Cases", () => {
  test("handles empty domain", () => {
    const result = saveConfig("", "token");

    expect(result).toBe(true);
    const config = readConfig();
    expect(config?.domain).toBe("");
  });

  test("handles empty token", () => {
    const result = saveConfig("test.instructure.com", "");

    expect(result).toBe(true);
    const config = readConfig();
    expect(config?.token).toBe("");
  });

  test("handles domain with subdirectory", () => {
    saveConfig("school.instructure.com/canvas", "token");

    const config = readConfig();
    expect(config?.domain).toBe("school.instructure.com/canvas");
  });

  test("handles very long token", () => {
    const longToken = "a".repeat(1000);
    saveConfig("test.instructure.com", longToken);

    const config = readConfig();
    expect(config?.token).toBe(longToken);
    expect(config?.token.length).toBe(1000);
  });

  test("handles special characters in token", () => {
    const specialToken = "token~!@#$%^&*()_+-={}[]|:;<>?,./";
    saveConfig("test.instructure.com", specialToken);

    const config = readConfig();
    expect(config?.token).toBe(specialToken);
  });

  test("handles unicode characters in domain", () => {
    saveConfig("école.instructure.com", "token");

    const config = readConfig();
    expect(config?.domain).toContain("cole");
  });
});
