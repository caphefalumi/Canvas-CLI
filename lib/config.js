/**
 * Configuration management for Canvas CLI
 */

require('dotenv').config();

/**
 * Load configuration from environment variables
 */
function loadConfig() {
  try {
    let domain = process.env.CANVAS_DOMAIN;
    const token = process.env.CANVAS_API_TOKEN;
    
    if (!domain || !token) {
      console.error('Missing required environment variables:');
      if (!domain) console.error('  CANVAS_DOMAIN is not set');
      if (!token) console.error('  CANVAS_API_TOKEN is not set');
      console.error('\nPlease create a .env file with:');
      console.error('CANVAS_DOMAIN=your-canvas-domain.instructure.com');
      console.error('CANVAS_API_TOKEN=your-api-token');
      process.exit(1);
    }
    
    // Clean up domain - remove https:// and trailing slashes
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    return { domain, token };
  } catch (error) {
    console.error(`Error loading configuration: ${error.message}`);
    process.exit(1);
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
  getInstanceConfig
};
