/**
 * Configuration validation and setup helpers
 */

import { configExists, readConfig } from './config.js';
import { createReadlineInterface, askQuestion } from './interactive.js';
import type { CanvasConfig } from '../types/index.js';

/**
 * Check if configuration is valid and prompt setup if needed
 */
async function ensureConfig(): Promise<boolean> {
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
    
    const { setupConfig } = await import('../commands/config.js');
    await setupConfig();
    
    if (!configExists()) {
      console.log('\nConfiguration setup was not completed. Please run "canvas config setup" to try again.');
      process.exit(1);
    }
    
    console.log('\nConfiguration complete! You can now use Canvas CLI commands.');
    return true;
  }
  
  // Validate existing config
  const config: CanvasConfig | null = readConfig();
  if (!config || !config.domain || !config.token) {
    console.log('Invalid configuration found. Please run "canvas config setup" to reconfigure.');
    process.exit(1);
  }
  
  return true;
}

/**
 * Wrapper function to ensure config exists before running a command
 */
export function requireConfig<T extends (...args: any[]) => any>(fn: T): T {
  return (async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    await ensureConfig();
    return fn(...args);
  }) as T;
}

export { ensureConfig };
