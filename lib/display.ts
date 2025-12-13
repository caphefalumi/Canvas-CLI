/**
 * Display library for consistent table rendering
 */

import chalk from 'chalk';
import type { CanvasCourse, CanvasAssignment, CanvasAnnouncement } from '../types/index.js';
import { makeCanvasRequest } from './api-client.js';
import { createReadlineInterface, askQuestion } from './interactive.js';

// ============================================================================
// Core Table Types and Classes
// ============================================================================

export interface ColumnDefinition {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  flex?: number; // Flex grow factor for remaining space
  align?: 'left' | 'right' | 'center';
  color?: (value: string, row: Record<string, any>) => string;
}

export interface TableOptions {
  title?: string;
  showRowNumbers?: boolean;
  rowNumberHeader?: string;
}

/**
 * Pad a string to a given length
 */
export function pad(str: string, len: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const strLen = stripAnsi(str).length;
  const padding = Math.max(0, len - strLen);
  
  if (align === 'right') {
    return ' '.repeat(padding) + str;
  } else if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  }
  return str + ' '.repeat(padding);
}

/**
 * Strip ANSI escape codes from a string to get true length
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Truncate string with ellipsis if too long
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Calculate column widths based on terminal size and column definitions
 */
function calculateColumnWidths(
  columns: ColumnDefinition[],
  data: Record<string, any>[],
  terminalWidth: number,
  showRowNumbers: boolean
): number[] {
  // Calculate borders overhead: │ + space per column + │
  const borderOverhead = 2 + (columns.length * 3) + 1;
  const rowNumWidth = showRowNumbers ? Math.max(3, String(data.length).length + 1) : 0;
  const rowNumOverhead = showRowNumbers ? 3 : 0; // │ + space + width
  
  // Ensure we have a reasonable terminal width (minimum 60, cap at actual terminal)
  const effectiveTermWidth = Math.max(60, Math.min(terminalWidth, 200));
  const availableWidth = effectiveTermWidth - borderOverhead - rowNumOverhead - rowNumWidth;
  
  const widths: number[] = [];
  const contentWidths: number[] = []; // Track actual content width for each column
  let fixedWidthTotal = 0;
  let totalFlex = 0;
  
  // First pass: calculate content widths and fixed widths
  columns.forEach((col, i) => {
    const headerLen = col.header.length;
    const maxContentLen = Math.max(headerLen, ...data.map(row => String(row[col.key] || '').length));
    contentWidths[i] = maxContentLen;
    
    if (col.width) {
      widths[i] = col.width;
      fixedWidthTotal += col.width;
    } else if (col.flex) {
      const minW = col.minWidth || Math.min(headerLen, 8);
      widths[i] = minW;
      fixedWidthTotal += minW;
      totalFlex += col.flex;
    } else {
      const minW = col.minWidth || Math.min(headerLen, 8);
      const maxW = col.maxWidth || maxContentLen;
      widths[i] = Math.min(maxW, Math.max(minW, maxContentLen));
      fixedWidthTotal += widths[i];
    }
  });
  
  // Second pass: distribute remaining width to flex columns (but cap at content width)
  const remainingWidth = Math.max(0, availableWidth - fixedWidthTotal);
  
  if (totalFlex > 0 && remainingWidth > 0) {
    columns.forEach((col, i) => {
      if (col.flex) {
        const extraWidth = Math.floor((remainingWidth * col.flex) / totalFlex);
        const maxW = col.maxWidth || contentWidths[i] || 50; // Cap at actual content width
        widths[i] = Math.min((widths[i] ?? 0) + extraWidth, maxW);
      }
    });
  }
  
  // Final pass: ensure total width doesn't exceed available width
  let totalWidth = widths.reduce((sum, w) => sum + (w ?? 0), 0);
  if (totalWidth > availableWidth) {
    // Scale down proportionally
    const scale = availableWidth / totalWidth;
    columns.forEach((col, i) => {
      const minW = col.minWidth || 8;
      widths[i] = Math.max(minW, Math.floor((widths[i] ?? 0) * scale));
    });
  }
  
  return widths;
}

/**
 * Table class for rendering data in a consistent box format
 */
export class Table {
  private columns: ColumnDefinition[];
  private data: Record<string, any>[];
  private options: TableOptions;
  private rowNumWidth: number = 0;

  constructor(columns: ColumnDefinition[], options: TableOptions = {}) {
    this.columns = columns;
    this.data = [];
    this.options = {
      showRowNumbers: true,
      rowNumberHeader: '#',
      ...options
    };
  }

  addRow(row: Record<string, any>): this {
    this.data.push(row);
    return this;
  }

  addRows(rows: Record<string, any>[]): this {
    this.data.push(...rows);
    return this;
  }

  /**
   * Render table once
   */
  render(): void {
    this.renderTable();
  }

  /**
   * Render table (same as render, kept for compatibility)
   */
  renderWithResize(): void {
    this.renderTable();
  }

  /**
   * No-op for compatibility
   */
  stopWatching(): void {
    // No-op - dynamic resize removed for cross-platform compatibility
  }

  private renderTable(): void {
    const terminalWidth = process.stdout.columns || 100;
    const widths = calculateColumnWidths(this.columns, this.data, terminalWidth, this.options.showRowNumbers!);
    
    if (this.options.showRowNumbers) {
      this.rowNumWidth = Math.max(3, String(this.data.length).length + 1);
    }

    if (this.options.title) {
      console.log(chalk.cyan.bold(`\n${this.options.title}`));
    }

    this.renderTopBorder(widths);
    this.renderHeader(widths);
    this.renderHeaderSeparator(widths);
    this.data.forEach((row, index) => this.renderRow(row, index, widths));
    this.renderBottomBorder(widths);
  }

  private renderTopBorder(widths: number[]): void {
    let border = chalk.gray('╭─');
    if (this.options.showRowNumbers) {
      border += chalk.gray('─'.repeat(this.rowNumWidth)) + chalk.gray('┬─');
    }
    border += widths.map(w => chalk.gray('─'.repeat(w))).join(chalk.gray('┬─'));
    border += chalk.gray('╮');
    console.log(border);
  }

  private renderHeader(widths: number[]): void {
    let header = chalk.gray('│ ');
    if (this.options.showRowNumbers) {
      header += chalk.cyan.bold(pad(this.options.rowNumberHeader!, this.rowNumWidth)) + chalk.gray('│ ');
    }
    header += this.columns.map((col, i) => 
      chalk.cyan.bold(pad(col.header, widths[i] || 10, col.align))
    ).join(chalk.gray('│ '));
    header += chalk.gray('│');
    console.log(header);
  }

  private renderHeaderSeparator(widths: number[]): void {
    let separator = chalk.gray('├─');
    if (this.options.showRowNumbers) {
      separator += chalk.gray('─'.repeat(this.rowNumWidth)) + chalk.gray('┼─');
    }
    separator += widths.map(w => chalk.gray('─'.repeat(w))).join(chalk.gray('┼─'));
    separator += chalk.gray('┤');
    console.log(separator);
  }

  private renderRow(row: Record<string, any>, index: number, widths: number[]): void {
    let rowStr = chalk.gray('│ ');
    if (this.options.showRowNumbers) {
      rowStr += chalk.white(pad(`${index + 1}.`, this.rowNumWidth)) + chalk.gray('│ ');
    }
    rowStr += this.columns.map((col, i) => {
      const colWidth = widths[i] || 10;
      let value = String(row[col.key] ?? '');
      value = truncate(value, colWidth);
      value = pad(value, colWidth, col.align);
      
      if (col.color) {
        value = col.color(value, row);
      } else {
        value = chalk.white(value);
      }
      return value;
    }).join(chalk.gray('│ '));
    rowStr += chalk.gray('│');
    console.log(rowStr);
  }

  private renderBottomBorder(widths: number[]): void {
    let border = chalk.gray('╰─');
    if (this.options.showRowNumbers) {
      border += chalk.gray('─'.repeat(this.rowNumWidth)) + chalk.gray('┴─');
    }
    border += widths.map(w => chalk.gray('─'.repeat(w))).join(chalk.gray('┴─'));
    border += chalk.gray('╯');
    console.log(border);
  }
}

// ============================================================================
// Course Display and Selection
// ============================================================================

export interface CoursePickerOptions {
  showAll?: boolean;
  title?: string;
  prompt?: string;
}

export interface CoursePickerResult {
  course: CanvasCourse;
  rl: ReturnType<typeof createReadlineInterface>;
}

/**
 * Display courses in a formatted table
 */
export function displayCourses(courses: CanvasCourse[], options: { showId?: boolean } = {}): void {
  const columns: ColumnDefinition[] = [
    { key: 'name', header: 'Course Name', flex: 1, minWidth: 15 }
  ];
  
  if (options.showId) {
    columns.push({ key: 'id', header: 'ID', minWidth: 5, maxWidth: 10 });
  }

  const table = new Table(columns);
  courses.forEach(course => {
    table.addRow({ name: course.name, id: course.id });
  });
  table.render();
}

/**
 * Interactive course picker - loads courses and lets user select one
 * Returns the selected course and the readline interface (caller should close it)
 */
export async function pickCourse(options: CoursePickerOptions = {}): Promise<CoursePickerResult | null> {
  const rl = createReadlineInterface();
  
  console.log(chalk.cyan.bold(options.title || '\nLoading your courses, please wait...'));
  
  const queryParams = [
    'enrollment_state=active',
    'include[]=favorites'
  ];
  
  const courses = await makeCanvasRequest<CanvasCourse[]>('get', 'courses', queryParams);
  
  if (!courses || courses.length === 0) {
    console.log(chalk.red('Error: No courses found.'));
    rl.close();
    return null;
  }

  let displayCourses = courses;
  if (!options.showAll) {
    const starred = courses.filter(c => c.is_favorite);
    if (starred.length > 0) {
      displayCourses = starred;
    }
  }

  console.log(chalk.green(`✓ Found ${displayCourses.length} course(s).`));
  
  // Calculate content width, capped to terminal width
  // Display courses table - flex will adapt to terminal width
  const table = new Table([
    { key: 'name', header: 'Course Name', flex: 1, minWidth: 15 }
  ]);
  displayCourses.forEach(course => table.addRow({ name: course.name }));
  table.renderWithResize();

  const prompt = options.prompt || chalk.bold.cyan('\nEnter course number: ');
  const courseChoice = await askQuestion(rl, prompt);
  
  // Stop watching for resize after user input
  table.stopWatching();
  
  if (!courseChoice.trim() || courseChoice === '..' || courseChoice.toLowerCase() === 'back') {
    console.log(chalk.red('No course selected. Exiting...'));
    rl.close();
    return null;
  }

  const courseIndex = parseInt(courseChoice) - 1;
  if (courseIndex < 0 || courseIndex >= displayCourses.length) {
    console.log(chalk.red('Invalid course selection.'));
    rl.close();
    return null;
  }

  const selectedCourse = displayCourses[courseIndex]!;
  console.log(chalk.green(`✓ Selected: ${selectedCourse.name}\n`));
  
  return { course: selectedCourse, rl };
}

// ============================================================================
// Assignment Display
// ============================================================================

export interface AssignmentDisplayOptions {
  showId?: boolean;
  showGrade?: boolean;
  showDueDate?: boolean;
  showStatus?: boolean;
}

/**
 * Format grade display with color coding
 */
export function formatGrade(submission: any, pointsPossible: number): { text: string; color: (s: string) => string } {
  if (submission && submission.score !== null && submission.score !== undefined) {
    const score = submission.score % 1 === 0 ? Math.round(submission.score) : submission.score;
    const text = `${score}/${pointsPossible}`;
    const percentage = pointsPossible > 0 ? (score / pointsPossible) * 100 : 0;
    
    let color = chalk.white;
    if (percentage >= 80) color = chalk.green;
    else if (percentage >= 50) color = chalk.yellow;
    else color = chalk.red;
    
    return { text, color };
  } else if (submission && submission.excused) {
    return { text: 'Excused', color: chalk.blue };
  } else if (submission && submission.missing) {
    return { text: 'Missing', color: chalk.red };
  } else if (pointsPossible) {
    return { text: `–/${pointsPossible}`, color: chalk.gray };
  }
  return { text: 'N/A', color: chalk.gray };
}

/**
 * Format due date for display
 */
export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString();
}

/**
 * Display assignments in a formatted table
 */
export function displayAssignments(
  assignments: CanvasAssignment[],
  options: AssignmentDisplayOptions = {}
): void {
  const columns: ColumnDefinition[] = [
    { key: 'name', header: 'Assignment Name', flex: 1, minWidth: 15 }
  ];

  if (options.showId) {
    columns.push({ key: 'id', header: 'ID', minWidth: 7, maxWidth: 10 });
  }
  
  if (options.showGrade) {
    columns.push({ 
      key: 'grade', 
      header: 'Grade', 
      minWidth: 8, 
      maxWidth: 12,
      color: (value, row) => {
        const gradeInfo = formatGrade(row._submission, row._pointsPossible);
        return gradeInfo.color(value);
      }
    });
  }
  
  if (options.showDueDate) {
    columns.push({ key: 'dueDate', header: 'Due Date', minWidth: 14, maxWidth: 22 });
  }
  
  if (options.showStatus) {
    columns.push({ 
      key: 'status', 
      header: 'Status', 
      minWidth: 10, 
      maxWidth: 14,
      color: (value, row) => {
        return row._isSubmitted ? chalk.green(value) : chalk.yellow(value);
      }
    });
  }

  const table = new Table(columns);
  
  assignments.forEach(assignment => {
    const submission = (assignment as any).submission;
    const gradeInfo = formatGrade(submission, assignment.points_possible || 0);
    const isSubmitted = !!(submission && submission.submitted_at);
    
    table.addRow({
      name: assignment.name,
      id: assignment.id,
      grade: gradeInfo.text,
      dueDate: formatDueDate(assignment.due_at),
      status: isSubmitted ? '✓ Submitted' : 'Not submitted',
      // Internal fields for color functions
      _submission: submission,
      _pointsPossible: assignment.points_possible || 0,
      _isSubmitted: isSubmitted
    });
  });
  
  table.render();
}

// ============================================================================
// Submit Assignment Display
// ============================================================================

/**
 * Get assignment type text based on submission_types and allowed_extensions
 */
function getAssignmentType(assignment: CanvasAssignment): string {
  if (!assignment.submission_types || assignment.submission_types.length === 0) {
    return 'Unknown';
  }
  
  const types = assignment.submission_types;
  if (types.includes('online_quiz')) {
    return 'Quiz';
  } else if (types.includes('online_upload')) {
    if (assignment.allowed_extensions && assignment.allowed_extensions.length > 0) {
      const exts = assignment.allowed_extensions.slice(0, 3);
      const extList = exts.join(', ');
      const suffix = assignment.allowed_extensions.length > 3 ? '...' : '';
      return `${extList}${suffix}`;
    }
    return 'Any file';
  } else if (types.includes('online_text_entry')) {
    return 'Text Entry';
  } else if (types.includes('online_url')) {
    return 'URL';
  } else if (types.includes('external_tool')) {
    return 'External Tool';
  } else if (types.includes('media_recording')) {
    return 'Media';
  } else if (types[0]) {
    return types[0].replace(/_/g, ' ');
  }
  return 'Unknown';
}

/**
 * Display assignments for submission in a formatted table
 * Returns the table instance so caller can stop watching for resize
 */
export function displaySubmitAssignments(assignments: CanvasAssignment[]): Table {
  const columns: ColumnDefinition[] = [
    { key: 'name', header: 'Assignment Name', flex: 1, minWidth: 20 },
    { key: 'type', header: 'Type', minWidth: 8, maxWidth: 18 },
    { key: 'dueDate', header: 'Due Date', minWidth: 16, maxWidth: 22 },
    { 
      key: 'status', 
      header: 'Status', 
      minWidth: 10, 
      maxWidth: 14,
      color: (value, row) => {
        return row._isSubmitted ? chalk.green(value) : chalk.yellow(value);
      }
    }
  ];

  const table = new Table(columns);
  
  assignments.forEach(assignment => {
    const submission = (assignment as any).submission;
    const isSubmitted = !!(submission && submission.submitted_at);
    
    table.addRow({
      name: assignment.name,
      type: getAssignmentType(assignment),
      dueDate: assignment.due_at 
        ? new Date(assignment.due_at).toLocaleString() 
        : 'No due date',
      status: isSubmitted ? '✓ Submitted' : 'Not submitted',
      _isSubmitted: isSubmitted
    });
  });
  
  table.renderWithResize();
  return table;
}

// ============================================================================
// Announcement Display
// ============================================================================

/**
 * Display announcements in a formatted table
 * Returns the table instance so caller can stop watching for resize
 */
export function displayAnnouncements(announcements: CanvasAnnouncement[]): Table {
  const columns: ColumnDefinition[] = [
    { key: 'title', header: 'Title', flex: 1, minWidth: 15 },
    { key: 'posted', header: 'Posted', width: 10 }
  ];

  const table = new Table(columns);
  
  announcements.forEach(announcement => {
    const date = announcement.posted_at 
      ? new Date(announcement.posted_at).toLocaleDateString() 
      : 'N/A';
    
    table.addRow({
      title: announcement.title || 'Untitled',
      posted: date
    });
  });
  
  table.renderWithResize();
  return table;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Print a horizontal separator line
 */
export function printSeparator(char: string = '─', length?: number): void {
  const width = length || (process.stdout.columns || 60);
  console.log(chalk.cyan.bold(char.repeat(width)));
}

/**
 * Print a section header
 */
export function printHeader(title: string): void {
  console.log(chalk.cyan.bold('\n' + '─'.repeat(60)));
  console.log(chalk.cyan.bold(title));
  console.log(chalk.cyan.bold('─'.repeat(60)));
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Print error message
 */
export function printError(message: string): void {
  console.log(chalk.red(`Error: ${message}`));
}

/**
 * Print info/loading message
 */
export function printInfo(message: string): void {
  console.log(chalk.cyan.bold(message));
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(message));
}

// ============================================================================
// Announcement Detail Display
// ============================================================================

/**
 * Clean HTML content and convert to readable text
 */
function cleanHtmlContent(html: string): string {
  return html
    // Replace common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Convert <br>, <br/>, <br /> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert </p>, </div>, </li> to newlines
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    // Convert <li> to bullet points
    .replace(/<li[^>]*>/gi, '• ')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Normalize multiple newlines to double newlines (paragraph breaks)
    .replace(/\n{3,}/g, '\n\n')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

/**
 * Word-wrap text to fit within a given width
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push(''); // Preserve empty lines for paragraph breaks
      continue;
    }
    
    const words = paragraph.split(' ').filter(w => w.length > 0);
    let currentLine = '';
    
    for (const word of words) {
      // Handle very long words by breaking them
      if (word.length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Break long word into chunks
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.substring(i, i + maxWidth));
        }
        continue;
      }
      
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  
  return lines;
}

export interface AnnouncementDetail {
  title: string;
  postedAt: string | null;
  author: string;
  message: string;
}

/**
 * Display announcement detail in a nicely formatted box
 */
export function displayAnnouncementDetail(announcement: AnnouncementDetail): void {
  const terminalWidth = process.stdout.columns || 80;
  // Use most of terminal width, with some padding
  const boxWidth = Math.max(50, terminalWidth - 4);
  const contentWidth = boxWidth - 4; // 2 chars for border + 2 chars for padding
  
  const title = announcement.title || 'Untitled';
  const date = announcement.postedAt ? new Date(announcement.postedAt).toLocaleString() : 'N/A';
  const author = announcement.author || 'Unknown';
  const cleanedMessage = cleanHtmlContent(announcement.message || 'No content');
  
  // Wrap title if needed
  const titleLines = wordWrap(title, contentWidth);
  
  // Wrap message content
  const messageLines = wordWrap(cleanedMessage, contentWidth);
  
  // Helper to print a padded line
  const printLine = (content: string, style: (s: string) => string = chalk.white) => {
    const paddedContent = content.padEnd(contentWidth);
    console.log(chalk.gray('│ ') + style(paddedContent) + chalk.gray(' │'));
  };
  
  // Top border
  console.log('\n' + chalk.gray('╭' + '─'.repeat(boxWidth - 2) + '╮'));
  
  // Title
  for (const line of titleLines) {
    printLine(line, chalk.bold.white);
  }
  
  // Separator
  console.log(chalk.gray('├' + '─'.repeat(boxWidth - 2) + '┤'));
  
  // Metadata
  printLine(`Posted: ${date}`, chalk.gray);
  printLine(`Author: ${author}`, chalk.gray);
  
  // Separator
  console.log(chalk.gray('├' + '─'.repeat(boxWidth - 2) + '┤'));
  
  // Message content
  for (const line of messageLines) {
    printLine(line, chalk.white);
  }
  
  // Bottom border
  console.log(chalk.gray('╰' + '─'.repeat(boxWidth - 2) + '╯') + '\n');
}
