/**
 * Configuration management for Canvas CLI
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration file path in user's home directory
const CONFIG_FILE = path.join(os.homedir(), '.canvaslms-cli-config.json');

/**
 * Get default configuration structure
 */
function getDefaultConfig() {
  return {
    domain: '',
    token: '',
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Load configuration from file
 */
function loadConfig() {
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
    console.error('❌ No Canvas configuration found!');
    console.error('\nPlease run "canvas config setup" to configure your Canvas credentials.');
    process.exit(1);  } catch (error) {
    console.error(`❌ Error loading configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Save configuration to file
 */
function saveConfig(domain, token) {
  try {
    const config = {
      domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      token,
      createdAt: fs.existsSync(CONFIG_FILE) ? 
        JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).createdAt : 
        new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`✅ Configuration saved to ${CONFIG_FILE}`);
    return true;
  } catch (error) {
    console.error(`❌ Error saving configuration: ${error.message}`);
    return false;
  }
}

/**
 * Get configuration file path
 */
function getConfigPath() {
  return CONFIG_FILE;
}

/**
 * Check if configuration file exists
 */
function configExists() {
  return fs.existsSync(CONFIG_FILE);
}

/**
 * Read current configuration (if exists)
 */
function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error(`❌ Error reading configuration: ${error.message}`);
    return null;
  }
}

/**
 * Delete configuration file
 */
function deleteConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      console.log('✅ Configuration file deleted successfully.');
      return true;
    } else {
      console.log('ℹ️  No configuration file found.');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error deleting configuration: ${error.message}`);
    return false;
  }
}

/**
 * Get the Canvas instance configuration
 */
function getInstanceConfig() {
  return loadConfig();
}

module.exports = {
  loadConfig,
  getInstanceConfig,
  saveConfig,
  getConfigPath,
  configExists,
  readConfig,
  deleteConfig,
  getDefaultConfig
};
