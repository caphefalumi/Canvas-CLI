import { makeCanvasRequest } from '../lib/api-client.js';
import { createReadlineInterface, askQuestion } from '../lib/interactive.js';
import chalk from 'chalk';

export async function showAnnouncements(courseId, options) {
  const rl = createReadlineInterface();
  try {
    if (!courseId) {
      console.log(chalk.cyan.bold('Loading your courses, please wait...\n'));
      const courses = await makeCanvasRequest('get', 'courses', [
        'enrollment_state=active',
        'include[]=favorites'
      ]);

      if (!courses || courses.length === 0) {
        console.log(chalk.red('Error: No courses found.'));
        rl.close();
        return;
      }

      console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
      console.log(chalk.cyan.bold('Select a course:'));
      courses.forEach((course, index) => {
        console.log(chalk.white(`${index + 1}.`) + ' ' + course.name);
      });

      const courseChoice = await askQuestion(rl, chalk.white('\nEnter course number: '));
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

      courseId = courses[courseIndex].id;
      console.log(chalk.green(`Success: Selected ${courses[courseIndex].name}\n`));
    }

    // ✅ FIXED: Use discussion_topics endpoint with only_announcements=true
    const limit = parseInt(options.limit) || 5;
    const announcements = await makeCanvasRequest(
      'get',
      `courses/${courseId}/discussion_topics`,
      [`only_announcements=true`, `per_page=${limit}`]
    );

    if (!announcements || announcements.length === 0) {
      console.log(chalk.yellow('No announcements found for this course.'));
      rl.close();
      return;
    }

    console.log(chalk.green('Success: Announcement loaded.'));
    console.log(chalk.cyan.bold('\n' + '-'.repeat(60)));
    console.log(chalk.cyan.bold('Announcements:'));
    announcements.forEach((a, i) => {
      const date = a.posted_at ? new Date(a.posted_at).toLocaleDateString() : '';
      console.log(chalk.white(`${i + 1}.`) + ' ' + a.title + chalk.gray(date ? ` (${date})` : ''));
    });

    const annChoice = await askQuestion(rl, chalk.white('\nEnter announcement number to view details: '));
    if (!annChoice.trim()) {
      console.log(chalk.red('No announcement selected. Exiting...'));
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
    const title = ann.title || 'Untitled';
    const date = ann.posted_at ? new Date(ann.posted_at).toLocaleString() : 'N/A';
    const author = ann.author?.display_name || 'Unknown';
    const message = ann.message?.replace(/<[^>]+>/g, '').trim() || 'No content';

    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.bold('  ' + title));
    console.log(chalk.cyan('-'.repeat(60)));
    console.log(chalk.gray('  Posted: ') + date);
    console.log(chalk.gray('  Author: ') + author);
    console.log('\n' + chalk.bold('  Message:') + '\n');
    console.log(message);
    console.log(chalk.cyan('='.repeat(60)) + '\n');

  } catch (error) {
    console.error(chalk.red('Error: Failed to fetch announcements: ') + error.message);
  } finally {
    rl.close();
  }
}

