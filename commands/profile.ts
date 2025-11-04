/**
 * Profile command
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import chalk from 'chalk';
import type { CanvasUser } from '../types/index.js';

interface ProfileOptions {
  verbose?: boolean;
}

export async function showProfile(options: ProfileOptions = {}): Promise<void> {
  try {
    console.log(chalk.cyan.bold('Loading profile, please wait...'));
    const user = await makeCanvasRequest<CanvasUser>('get', 'users/self', ['include[]=email', 'include[]=locale']);
    
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
      console.log(chalk.white('Locale: ') + ((user as any).locale || 'N/A'));
      console.log(chalk.white('Time Zone: ') + ((user as any).time_zone || 'N/A'));
      console.log(chalk.white('Avatar URL: ') + (user.avatar_url || 'N/A'));
      console.log(chalk.white('Created: ') + ((user as any).created_at ? new Date((user as any).created_at).toLocaleString() : 'N/A'));
    }
    console.log(chalk.green('Success: Profile loaded.'));
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error: Failed to fetch profile: ') + errorMessage);
    process.exit(1);
  }
}
