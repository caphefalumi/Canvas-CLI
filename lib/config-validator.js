/**
 * Configuration validation and setup helpers
 */

import { configExists, readConfig } from './config.js';
import { createReadlineInterface, askQuestion } from './interactive.js';

/**
 * Check if configuration is valid and prompt setup if needed
 */
async function ensureConfig() {
  if (!configExists()) {
    console.log('No Canvas configuration found!');
    console.log('\nLet\'s set up your Canvas CLI configuration...\n');
    
    const rl = createReadlineInterface();
    const setup = await askQuestion(rl, 'Would you like to set up your configuration now? (Y/n): ');
    rl.close();
    
    if (setup.toLowerCase() === 'n' || setup.toLowerCase() === 'no') {
      console.log('\nTo set up later, run: canvas config setup');
      console.log('Or set environment variables: CANVAS_DOMAIN and CANVAS_API_TOKEN');
      process.exit(1);
    }
    
    // Import and run setup (dynamic import to avoid circular dependency)
    const { setupConfig } = await import('../commands/config.js');
    await setupConfig();
    
    // Check if setup was successful
    if (!configExists()) {
      console.log('\nConfiguration setup was not completed. Please run "canvas config setup" to try again.');
      process.exit(1);
    }
    
    console.log('\nConfiguration complete! You can now use Canvas CLI commands.');
    return true;
  }
  
  // Validate existing config
  const config = readConfig();
  if (!config || !config.domain || !config.token) {
    console.log('Invalid configuration found. Please run "canvas config setup" to reconfigure.');
    process.exit(1);
  }
  
  return true;
}

/**
 * Wrapper function to ensure config exists before running a command
 */
export function requireConfig(fn) {
  return async function(...args) {
    await ensureConfig();
    return fn(...args);
  };
}

export { ensureConfig };
