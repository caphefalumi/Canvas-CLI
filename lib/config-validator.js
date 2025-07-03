/**
 * Configuration validation and setup helpers
 */

const { configExists, readConfig } = require('./config');
const { createReadlineInterface, askQuestion } = require('./interactive');

/**
 * Check if configuration is valid and prompt setup if needed
 */
async function ensureConfig() {
  if (!configExists()) {
    console.log('❌ No Canvas configuration found!');
    console.log('\n🚀 Let\'s set up your Canvas CLI configuration...\n');
    
    const rl = createReadlineInterface();
    const setup = await askQuestion(rl, 'Would you like to set up your configuration now? (Y/n): ');
    rl.close();
    
    if (setup.toLowerCase() === 'n' || setup.toLowerCase() === 'no') {
      console.log('\n📝 To set up later, run: canvas config setup');
      console.log('💡 Or set environment variables: CANVAS_DOMAIN and CANVAS_API_TOKEN');
      process.exit(1);
    }
    
    // Import and run setup (dynamic import to avoid circular dependency)
    const { setupConfig } = require('../commands/config');
    await setupConfig();
    
    // Check if setup was successful
    if (!configExists()) {
      console.log('\n❌ Configuration setup was not completed. Please run "canvas config setup" to try again.');
      process.exit(1);
    }
    
    console.log('\n✅ Configuration complete! You can now use Canvas CLI commands.');
    return true;
  }
  
  // Validate existing config
  const config = readConfig();
  if (!config || !config.domain || !config.token) {
    console.log('❌ Invalid configuration found. Please run "canvas config setup" to reconfigure.');
    process.exit(1);
  }
  
  return true;
}

/**
 * Wrapper function to ensure config exists before running a command
 */
function requireConfig(commandFunction) {
  return async function(...args) {
    await ensureConfig();
    return commandFunction(...args);
  };
}

module.exports = {
  ensureConfig,
  requireConfig
};
