import { makeCanvasRequest } from '../lib/api-client.js';
import { createReadlineInterface, askQuestion } from '../lib/interactive.js';
import chalk from 'chalk';
import type { CanvasCourse, CanvasAnnouncement, ShowAnnouncementsOptions } from '../types/index.js';

function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

export async function showAnnouncements(courseId?: string, options: ShowAnnouncementsOptions = {}): Promise<void> {
  const rl = createReadlineInterface();
  try {
    let selectedCourseId = courseId;
    
    if (!selectedCourseId) {
      console.log(chalk.cyan.bold('\nLoading your courses, please wait...'));
      let courses = await makeCanvasRequest<CanvasCourse[]>('get', 'courses', [
        'enrollment_state=active',
        'include[]=favorites'
      ]);

      if (!courses || courses.length === 0) {
        console.log(chalk.red('Error: No courses found.'));
        rl.close();
        return;
      }

      console.log(chalk.green(`✓ Found ${courses.length} course(s).`));

      // Calculate dynamic column widths
      const colNo = Math.max(3, String(courses.length).length + 1);
      const terminalWidth = process.stdout.columns || 80;
      const overhead = 10 + colNo;
      const maxNameLength = Math.max(11, ...courses.map(c => c.name.length));
      const colName = Math.min(maxNameLength, terminalWidth - overhead);

      // Top border (rounded)
      console.log(
        chalk.gray('╭─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┬─') +
        chalk.gray('─'.repeat(colName)) + chalk.gray('╮')
      );

      // Header
      console.log(
        chalk.gray('│ ') + chalk.cyan.bold(pad('#', colNo)) + chalk.gray('│ ') +
        chalk.cyan.bold(pad('Course Name', colName)) + chalk.gray('│')
      );

      // Header separator
      console.log(
        chalk.gray('├─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┼─') +
        chalk.gray('─'.repeat(colName)) + chalk.gray('┤')
      );

      // Rows
      courses.forEach((course, index) => {
        let displayName = course.name;
        if (displayName.length > colName) {
          displayName = displayName.substring(0, colName - 3) + '...';
        }
        console.log(
          chalk.gray('│ ') + chalk.white(pad((index + 1) + '.', colNo)) + chalk.gray('│ ') +
          chalk.white(pad(displayName, colName)) + chalk.gray('│')
        );
      });

      // Bottom border (rounded)
      console.log(
        chalk.gray('╰─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┴─') +
        chalk.gray('─'.repeat(colName)) + chalk.gray('╯')
      );

      const courseChoice = await askQuestion(rl, chalk.bold.cyan('\nEnter course number: '));
      if (!courseChoice.trim()) {
        console.log(chalk.red('No course selected. Exiting...'));
        rl.close();
        return;
      }

      const courseIndex = parseInt(courseChoice) - 1;
      if (courseIndex < 0 || courseIndex >= courses.length) {
        console.log(chalk.red('Invalid course selection.'));
        rl.close();
        return;
      }

      selectedCourseId = String(courses[courseIndex]?.id);
      console.log(chalk.green(`✓ Selected: ${courses[courseIndex]?.name}\n`));
    }

    const limit = parseInt(options.limit || '5') || 5;
    console.log(chalk.cyan.bold('Loading announcements...'));
    
    const announcements = await makeCanvasRequest<CanvasAnnouncement[]>(
      'get',
      `courses/${selectedCourseId}/discussion_topics`,
      [`only_announcements=true`, `per_page=${limit}`]
    );

    if (!announcements || announcements.length === 0) {
      console.log(chalk.yellow('No announcements found for this course.'));
      rl.close();
      return;
    }

    console.log(chalk.green(`✓ Found ${announcements.length} announcement(s).`));

    // Calculate dynamic column widths for announcements table
    const colNo = Math.max(3, String(announcements.length).length + 1);
    const colDate = 12;
    const terminalWidth = process.stdout.columns || 80;
    const overhead = 14 + colNo + colDate;
    const maxTitleLength = Math.max(5, ...announcements.map(a => (a.title || 'Untitled').length));
    const colTitle = Math.min(maxTitleLength, terminalWidth - overhead);

    // Top border (rounded)
    console.log(
      chalk.gray('╭─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colTitle)) + chalk.gray('┬─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('╮')
    );

    // Header
    console.log(
      chalk.gray('│ ') + chalk.cyan.bold(pad('#', colNo)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Title', colTitle)) + chalk.gray('│ ') +
      chalk.cyan.bold(pad('Posted', colDate)) + chalk.gray('│')
    );

    // Header separator
    console.log(
      chalk.gray('├─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colTitle)) + chalk.gray('┼─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('┤')
    );

    // Rows
    announcements.forEach((a, i) => {
      let displayTitle = a.title || 'Untitled';
      if (displayTitle.length > colTitle) {
        displayTitle = displayTitle.substring(0, colTitle - 3) + '...';
      }
      const date = a.posted_at ? new Date(a.posted_at).toLocaleDateString() : 'N/A';

      console.log(
        chalk.gray('│ ') + chalk.white(pad((i + 1) + '.', colNo)) + chalk.gray('│ ') +
        chalk.white(pad(displayTitle, colTitle)) + chalk.gray('│ ') +
        chalk.gray(pad(date, colDate)) + chalk.gray('│')
      );
    });

    // Bottom border (rounded)
    console.log(
      chalk.gray('╰─') + chalk.gray('─'.repeat(colNo)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colTitle)) + chalk.gray('┴─') +
      chalk.gray('─'.repeat(colDate)) + chalk.gray('╯')
    );

    const annChoice = await askQuestion(rl, chalk.bold.cyan('\nEnter announcement number to view details (0 to exit): '));
    if (!annChoice.trim() || annChoice === '0') {
      console.log(chalk.yellow('Exiting announcements viewer.'));
      rl.close();
      return;
    }

    const annIndex = parseInt(annChoice) - 1;
    if (annIndex < 0 || annIndex >= announcements.length) {
      console.log(chalk.red('Invalid announcement selection.'));
      rl.close();
      return;
    }

    const ann = announcements[annIndex];
    const title = ann?.title || 'Untitled';
    const date = ann?.posted_at ? new Date(ann.posted_at).toLocaleString() : 'N/A';
    const author = ann?.author?.display_name || 'Unknown';
    const message = ann?.message?.replace(/<[^>]+>/g, '').trim() || 'No content';

    // Display announcement detail in a nice adaptive box
    const detailTermWidth = process.stdout.columns || 80;
    const boxWidth = Math.max(50, Math.min(80, detailTermWidth - 4));
    
    console.log('\n' + chalk.cyan('╭' + '─'.repeat(boxWidth) + '╮'));
    console.log(chalk.cyan('│') + chalk.bold.white(' ' + title.substring(0, boxWidth - 2)).padEnd(boxWidth) + chalk.cyan('│'));
    console.log(chalk.cyan('├' + '─'.repeat(boxWidth) + '┤'));
    console.log(chalk.cyan('│') + chalk.gray(' Posted: ') + chalk.white(date).padEnd(boxWidth - 9) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(' Author: ') + chalk.white(author).padEnd(boxWidth - 9) + chalk.cyan('│'));
    console.log(chalk.cyan('├' + '─'.repeat(boxWidth) + '┤'));
    
    // Word-wrap message content
    const contentWidth = boxWidth - 2;
    const words = message.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= contentWidth) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) {
          console.log(chalk.cyan('│') + ' ' + currentLine.padEnd(contentWidth) + chalk.cyan('│'));
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      console.log(chalk.cyan('│') + ' ' + currentLine.padEnd(contentWidth) + chalk.cyan('│'));
    }
    
    console.log(chalk.cyan('╰' + '─'.repeat(boxWidth) + '╯') + '\n');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error: Failed to fetch announcements: ') + errorMessage);
  } finally {
    rl.close();
  }
}
