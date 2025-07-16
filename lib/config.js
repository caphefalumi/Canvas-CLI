/**
 * Configuration management for Canvas CLI
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration file path in user's home directory
const CONFIG_FILE = path.join(os.homedir(), '.canvaslms-cli-config.json');

// Get default configuration structure
export function getDefaultConfig() {
  return {
    domain: '',
    token: '',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

// Load configuration from file
export function loadConfig() {
  try {
    // Load from config file
    if (fs.existsSync(CONFIG_FILE)) {
      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (configData.domain && configData.token) {
        // Clean up domain - remove https:// and trailing slashes
        const domain = configData.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return { domain, token: configData.token };
      }
    }
    // No configuration found
    console.error('No Canvas configuration found!');
    console.error('\nPlease run "canvas config setup" to configure your Canvas credentials.');
    process.exit(1);
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

// Save configuration to file
export function saveConfig(domain, token) {
  try {
    const config = {
      domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      token,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error saving configuration: ${error.message}`);
    return false;
  }
}

// Check if config file exists
export function configExists() {
  return fs.existsSync(CONFIG_FILE);
}

// Get config file path
export function getConfigPath() {
  return CONFIG_FILE;
}

// Delete config file
export function deleteConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error deleting configuration: ${error.message}`);
    return false;
  }
}

// Read current configuration (if exists)
export function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error(`Error reading configuration: ${error.message}`);
    return null;
  }
}

/**
 * Get the Canvas instance configuration
 */
export function getInstanceConfig() {
  return loadConfig();
}
