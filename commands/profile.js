/**
 * Profile command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import chalk from 'chalk';

export async function showProfile(options) {
  try {
    console.log(chalk.cyan.bold('Loading profile, please wait...'));
    const user = await makeCanvasRequest('get', 'users/self', ['include[]=email', 'include[]=locale']);
    
    console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('User Profile'));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.white('Name: ') + user.name);
    console.log(chalk.white('ID: ') + user.id);
    console.log(chalk.white('Email: ') + (user.email || 'N/A'));
    console.log(chalk.white('Login ID: ') + (user.login_id || 'N/A'));
    
    if (options.verbose) {
      console.log(chalk.white('Short Name: ') + (user.short_name || 'N/A'));
      console.log(chalk.white('Sortable Name: ') + (user.sortable_name || 'N/A'));
      console.log(chalk.white('Locale: ') + (user.locale || 'N/A'));
      console.log(chalk.white('Time Zone: ') + (user.time_zone || 'N/A'));
      console.log(chalk.white('Avatar URL: ') + (user.avatar_url || 'N/A'));
      console.log(chalk.white('Created: ') + (user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'));
    }
    console.log(chalk.green('Success: Profile loaded.'));
    
  } catch (error) {
    console.error(chalk.red('Error: Failed to fetch profile: ') + error.message);
    process.exit(1);
  }
}
