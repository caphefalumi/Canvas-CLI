// Temporary stub - full TypeScript migration pending for grades command
import type { Command } from 'commander';

export function showGrades(_command: Command): void {
  console.log('Grades command not yet migrated to TypeScript. Please use the JavaScript version.');
  process.exit(1);
}
