/**
 * Configuration management for Canvas CLI
 */

import fs from "fs";
import path from "path";
import os from "os";
import type { CanvasConfig, InstanceConfig } from "../types/index.js";

// Configuration file path in user's home directory
const CONFIG_FILE = path.join(os.homedir(), ".canvaslms-cli-config.json");

// Get default configuration structure
export function getDefaultConfig(): CanvasConfig {
  return {
    domain: "",
    token: "",
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

// Load configuration from file
export function loadConfig(): InstanceConfig {
  try {
    // Load from config file
    if (fs.existsSync(CONFIG_FILE)) {
      const configData: CanvasConfig = JSON.parse(
        fs.readFileSync(CONFIG_FILE, "utf8"),
      );
      if (configData.domain && configData.token) {
        // Clean up domain - remove https:// and trailing slashes
        const domain = configData.domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");
        return { domain, token: configData.token };
      }
    }
    // No configuration found
    console.error("No Canvas configuration found!");
    console.error(
      '\nPlease run "canvas config setup" to configure your Canvas credentials.',
    );
    process.exit(1);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading configuration: ${errorMessage}`);
    process.exit(1);
  }
}

// Save configuration to file
export function saveConfig(
  domain: string,
  token: string,
  tableTruncate?: boolean,
): boolean {
  try {
    const config: CanvasConfig = {
      domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      token,
      tableTruncate,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error saving configuration: ${errorMessage}`);
    return false;
  }
}

// Check if config file exists
export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

// Get config file path
export function getConfigPath(): string {
  return CONFIG_FILE;
}

// Delete config file
export function deleteConfig(): boolean {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      return true;
    }
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error deleting configuration: ${errorMessage}`);
    return false;
  }
}

// Read current configuration (if exists)
export function readConfig(): CanvasConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as CanvasConfig;
    }
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error reading configuration: ${errorMessage}`);
    return null;
  }
}

/**
 * Get the Canvas instance configuration
 */
export function getInstanceConfig(): InstanceConfig {
  return loadConfig();
}
