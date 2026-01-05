/**
 * Display library for consistent table rendering
 */

import chalk from "chalk";
import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasAnnouncement,
} from "../types/index.js";
import { makeCanvasRequest } from "./api-client.js";
import { createReadlineInterface, askQuestion } from "./interactive.js";
import * as readline from "readline"; // Import the native readline module
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
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
  align?: "left" | "right" | "center";
  color?: (value: string, row: Record<string, any>) => string;
}

export interface TableOptions {
  title?: string;
  showRowNumbers?: boolean;
  rowNumberHeader?: string;
  truncate?: boolean;
}

/**
 * Pad a string to a given length
 */
export function pad(
  str: string,
  len: number,
  align: "left" | "right" | "center" = "left",
): string {
  const strLen = stripAnsi(str).length;
  const padding = Math.max(0, len - strLen);

  if (align === "right") {
    return " ".repeat(padding) + str;
  } else if (align === "center") {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return " ".repeat(leftPad) + str + " ".repeat(rightPad);
  }
  return str + " ".repeat(padding);
}

/**
 * Strip ANSI escape codes from a string to get true length
 * Handles CSI sequences (ESC [ ... m) and OSC sequences (ESC ] ... BEL/ST)
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return (
    str
      // Remove CSI sequences: ESC [ ... (letter)
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
      // Remove OSC sequences: ESC ] ... BEL or ESC ] ... ESC \
      .replace(/\x1B\].*?(?:\x07|\x1B\\)/g, "")
  );
}

/**
 * Truncate string with ellipsis if too long
 */
export function truncate(str: string, maxLen: number): string {
  // Operate on visible length (strip ANSI) so color codes don't affect truncation
  const visible = stripAnsi(str);
  if (visible.length <= maxLen) return str;

  // If maxLen is too small to include ellipsis, just cut hard
  if (maxLen <= 3) return visible.substring(0, maxLen);

  const truncatedVisible =
    visible.substring(0, Math.max(0, maxLen - 3)) + "...";
  // Return plain truncated visible string (colors should be applied after truncate)
  return truncatedVisible;
}

/**
 * Wrap text to multiple lines based on max width
 */
function wrapText(str: string, maxWidth: number): string[] {
  const visible = stripAnsi(str);
  if (visible.length <= maxWidth) return [str];

  const lines: string[] = [];
  let currentLine = "";
  let currentLength = 0;

  const words = visible.split(" ");
  for (const word of words) {
    if (currentLength + word.length + (currentLength > 0 ? 1 : 0) <= maxWidth) {
      if (currentLength > 0) {
        currentLine += " ";
        currentLength++;
      }
      currentLine += word;
      currentLength += word.length;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // If a single word is longer than maxWidth, split it
      if (word.length > maxWidth) {
        let remainingWord = word;
        while (remainingWord.length > maxWidth) {
          lines.push(remainingWord.substring(0, maxWidth));
          remainingWord = remainingWord.substring(maxWidth);
        }
        currentLine = remainingWord;
        currentLength = remainingWord.length;
      } else {
        currentLine = word;
        currentLength = word.length;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

/**
 * Calculate column widths based on terminal size and column definitions
 */
function calculateColumnWidths(
  columns: ColumnDefinition[],
  data: Record<string, any>[],
  terminalWidth: number,
  showRowNumbers: boolean,
): number[] {
  const numCols = columns.length;
  // Border overhead: "│ " at start (2) + "│ " between each column (2 * (n-1)) + "│" at end (1)
  // = 2 + 2n - 2 + 1 = 2n + 1
  const borderOverhead = 2 * numCols + 1;
  const rowNumWidth = showRowNumbers
    ? Math.max(3, String(data.length).length + 1)
    : 0;
  // Row number overhead: "│ " before + the width itself
  const rowNumOverhead = showRowNumbers ? 2 + rowNumWidth : 0;

  // Use actual terminal width, cap at 240 for sanity
  const effectiveTermWidth = Math.min(terminalWidth, 240);
  const availableWidth = Math.max(
    numCols * 4,
    effectiveTermWidth - borderOverhead - rowNumOverhead,
  );

  let widths: number[] = [];
  const contentWidths: number[] = [];
  let fixedWidthTotal = 0;
  let totalFlex = 0;

  // First pass: calculate content widths and fixed widths
  columns.forEach((col, i) => {
    const headerLen = stripAnsi(col.header).length;
    const maxContentLen = Math.max(
      headerLen,
      ...data.map((row) => stripAnsi(String(row[col.key] ?? "")).length),
    );
    contentWidths[i] = maxContentLen;

    if (col.width) {
      widths[i] = col.width;
      fixedWidthTotal += col.width;
    } else if (col.flex) {
      const minW = col.minWidth || 4;
      widths[i] = minW;
      fixedWidthTotal += minW;
      totalFlex += col.flex;
    } else {
      const minW = col.minWidth || 4;
      const maxW = col.maxWidth || maxContentLen;
      widths[i] = Math.min(maxW, Math.max(minW, maxContentLen));
      fixedWidthTotal += widths[i];
    }
  });

  // Second pass: distribute remaining width to flex columns
  const remainingWidth = Math.max(0, availableWidth - fixedWidthTotal);

  if (totalFlex > 0 && remainingWidth > 0) {
    columns.forEach((col, i) => {
      if (col.flex) {
        const extraWidth = Math.floor((remainingWidth * col.flex) / totalFlex);
        const maxW = col.maxWidth || 999;
        widths[i] = Math.min((widths[i] ?? 0) + extraWidth, maxW);
      }
    });
  }

  // Final pass: force fit to available width
  let totalWidth = widths.reduce((sum, w) => sum + (w ?? 0), 0);
  while (totalWidth > availableWidth && totalWidth > numCols * 4) {
    // Find the widest column and shrink it
    let maxIdx = 0;
    let maxW = widths[0] ?? 0;
    for (let i = 1; i < widths.length; i++) {
      if ((widths[i] ?? 0) > maxW) {
        maxW = widths[i] ?? 0;
        maxIdx = i;
      }
    }
    if (maxW <= 4) break; // Can't shrink further
    widths[maxIdx] = Math.max(4, maxW - 1);
    totalWidth--;
  }

  return widths;
}

/**
 * Table class for rendering data in a consistent box format
 * Supports live resize using "Inline Clearing" (preserves history)
 */
export class Table {
  private columns: ColumnDefinition[];
  private data: Record<string, any>[];
  private options: TableOptions;
  private rowNumWidth: number = 0;
  private resizeHandler: (() => void) | null = null;
  private isWatching: boolean = false;
  private promptText: string | null = null;

  // State for resize handling
  private lastOutput: string = "";
  private resizeTimeout: NodeJS.Timeout | null = null;
  private logger: ((str: string) => void) | undefined;

  constructor(columns: ColumnDefinition[], options: TableOptions = {}) {
    this.columns = columns;
    this.data = [];
    this.options = {
      showRowNumbers: true,
      rowNumberHeader: "#",
      truncate: false, // Default to not truncating for backward compatibility
      ...options,
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

  setPrompt(prompt: string): this {
    this.promptText = prompt;
    return this;
  }

  render(logger?: (str: string) => void): void {
    this.logger = logger;
    this.renderTable(logger);
  }

  renderWithResize(logger?: (str: string) => void): void {
    this.logger = logger;
    this.renderTable(logger);
    this.startWatching();
  }

  private startWatching(): void {
    if (this.isWatching || !process.stdout.isTTY) return;

    this.resizeHandler = () => {
      // Debounce: Cancel any pending resize action
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);

      // Wait 100ms for the resize to "settle"
      this.resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 100);
    };

    process.stdout.on("resize", this.resizeHandler);
    this.isWatching = true;
  }

  stopWatching(): void {
    if (!this.isWatching || !this.resizeHandler) return;
    process.stdout.removeListener("resize", this.resizeHandler);
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeHandler = null;
    this.isWatching = false;
  }

  private handleResize(): void {
    // 1. Calculate how tall the PREVIOUS output is in the NEW terminal width
    // We must pass the `lastOutput` to calculate accurate line wrapping
    const lineCount = this.countVisualLines(this.lastOutput);

    // 2. Move cursor up to the start of the old table
    if (lineCount > 0 && !this.logger) {
      readline.moveCursor(process.stdout, 0, -lineCount);
    }

    // 3. Clear everything from cursor down
    if (!this.logger) {
      readline.clearScreenDown(process.stdout);
    }

    // 4. Redraw
    this.renderTable(this.logger);
  }

  /**
   * accurately counts how many visual lines a string occupies,
   * accounting for wrapping in the current terminal width.
   */
  private countVisualLines(text: string): number {
    if (!text) return 0;

    const width = process.stdout.columns || 80;
    const lines = text.split("\n");
    let count = 0;

    for (const line of lines) {
      const visibleLen = stripAnsi(line).length;
      if (visibleLen === 0) {
        count++; // Empty line is still 1 line
      } else {
        // We use ceil to account for wrapping.
        // e.g. Length 85 in Width 80 = 2 lines.
        count += Math.ceil(visibleLen / width);
      }
    }
    return count;
  }

  private renderTable(logger?: (str: string) => void): void {
    // Buffer output so we can measure it later
    let output = "";
    const appendLn = (s: string) => (output += s + "\n");
    const append = (s: string) => (output += s);

    const terminalWidth = process.stdout.columns || 100;
    const widths = calculateColumnWidths(
      this.columns,
      this.data,
      terminalWidth,
      this.options.showRowNumbers!,
    );

    if (this.options.showRowNumbers) {
      this.rowNumWidth = Math.max(3, String(this.data.length).length + 1);
    }

    if (this.options.title) {
      appendLn(chalk.cyan.bold(`\n${this.options.title}`));
    }

    // --- Build Table ---

    // Top Border
    let border = chalk.gray("╭─");
    if (this.options.showRowNumbers) {
      border += chalk.gray("─".repeat(this.rowNumWidth)) + chalk.gray("┬─");
    }
    border += widths
      .map((w) => chalk.gray("─".repeat(w)))
      .join(chalk.gray("┬─"));
    border += chalk.gray("╮");
    appendLn(border);

    // Header
    let header = chalk.gray("│ ");
    if (this.options.showRowNumbers) {
      header +=
        chalk.cyan.bold(
          pad(
            truncate(this.options.rowNumberHeader!, this.rowNumWidth),
            this.rowNumWidth,
          ),
        ) + chalk.gray("│ ");
    }
    header += this.columns
      .map((col, i) => {
        const colWidth = widths[i] || 10;
        return chalk.cyan.bold(
          pad(truncate(col.header, colWidth), colWidth, col.align),
        );
      })
      .join(chalk.gray("│ "));
    header += chalk.gray("│");
    appendLn(header);

    // Separator
    let separator = chalk.gray("├─");
    if (this.options.showRowNumbers) {
      separator += chalk.gray("─".repeat(this.rowNumWidth)) + chalk.gray("┼─");
    }
    separator += widths
      .map((w) => chalk.gray("─".repeat(w)))
      .join(chalk.gray("┼─"));
    separator += chalk.gray("┤");
    appendLn(separator);

    // Rows
    this.data.forEach((row, index) => {
      // When truncate is disabled, we need to handle multi-line rows
      if (this.options.truncate === false) {
        // First, calculate wrapped lines for each column
        const wrappedColumns: string[][] = this.columns.map((col, i) => {
          const colWidth = widths[i] || 10;
          const value = String(row[col.key] ?? "");
          return wrapText(value, colWidth);
        });

        // Find the maximum number of lines needed
        const maxLines = Math.max(
          ...wrappedColumns.map((lines) => lines.length),
        );

        // Render each line of this row
        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
          let rowStr = chalk.gray("│ ");

          // Row number only on first line
          if (this.options.showRowNumbers) {
            if (lineIdx === 0) {
              rowStr +=
                chalk.white(pad(`${index + 1}.`, this.rowNumWidth)) +
                chalk.gray("│ ");
            } else {
              rowStr += " ".repeat(this.rowNumWidth) + chalk.gray("│ ");
            }
          }

          rowStr += this.columns
            .map((col, i) => {
              const colWidth = widths[i] || 10;
              const lines = wrappedColumns[i] || [];
              let value = lineIdx < lines.length ? lines[lineIdx] || "" : "";
              value = pad(value, colWidth, col.align);
              if (col.color && lineIdx === 0) value = col.color(value, row);
              else value = chalk.white(value);
              return value;
            })
            .join(chalk.gray("│ "));
          rowStr += chalk.gray("│");
          appendLn(rowStr);
        }

        // Always add spacing between rows (empty row) in wrap mode
        if (index < this.data.length - 1) {
          let spacer = chalk.gray("│ ");
          if (this.options.showRowNumbers) {
            spacer += " ".repeat(this.rowNumWidth) + chalk.gray("│ ");
          }
          spacer += widths.map((w) => " ".repeat(w)).join(chalk.gray("│ "));
          spacer += chalk.gray("│");
          appendLn(spacer);
        }
      } else {
        // Original truncate behavior
        let rowStr = chalk.gray("│ ");
        if (this.options.showRowNumbers) {
          rowStr +=
            chalk.white(pad(`${index + 1}.`, this.rowNumWidth)) +
            chalk.gray("│ ");
        }
        rowStr += this.columns
          .map((col, i) => {
            const colWidth = widths[i] || 10;
            let value = String(row[col.key] ?? "");
            value = truncate(value, colWidth);
            value = pad(value, colWidth, col.align);
            if (col.color) value = col.color(value, row);
            else value = chalk.white(value);
            return value;
          })
          .join(chalk.gray("│ "));
        rowStr += chalk.gray("│");
        appendLn(rowStr);
      }
    });

    // Bottom Border
    let bottom = chalk.gray("╰─");
    if (this.options.showRowNumbers) {
      bottom += chalk.gray("─".repeat(this.rowNumWidth)) + chalk.gray("┴─");
    }
    bottom += widths
      .map((w) => chalk.gray("─".repeat(w)))
      .join(chalk.gray("┴─"));
    bottom += chalk.gray("╯");
    appendLn(bottom);

    if (this.promptText) {
      append(this.promptText);
    }

    // Save state and print
    this.lastOutput = output;
    if (logger) {
      logger(output);
    } else {
      process.stdout.write(output);
    }
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
export function displayCourses(
  courses: CanvasCourse[],
  options: { showId?: boolean } = {},
  logger?: (str: string) => void,
): void {
  const columns: ColumnDefinition[] = [
    { key: "name", header: "Course Name", flex: 1, minWidth: 15 },
  ];

  if (options.showId) {
    columns.push({ key: "id", header: "ID", minWidth: 5, maxWidth: 10 });
  }

  const table = new Table(columns);
  courses.forEach((course) => {
    table.addRow({ name: course.name, id: course.id });
  });
  table.render(logger);
}

/**
 * Interactive course picker - loads courses and lets user select one
 * Returns the selected course and the readline interface (caller should close it)
 */
export async function pickCourse(
  options: CoursePickerOptions = {},
): Promise<CoursePickerResult | null> {
  const rl = createReadlineInterface();

  console.log(
    chalk.cyan.bold(options.title || "\nLoading your courses, please wait..."),
  );

  const queryParams = ["enrollment_state=active", "include[]=favorites"];

  const courses = await makeCanvasRequest<CanvasCourse[]>(
    "get",
    "courses",
    queryParams,
  );

  if (!courses || courses.length === 0) {
    console.log(chalk.red("Error: No courses found."));
    rl.close();
    return null;
  }

  let displayCourses = courses;
  if (!options.showAll) {
    const starred = courses.filter((c) => c.is_favorite);
    if (starred.length > 0) {
      displayCourses = starred;
    }
  }

  console.log(chalk.green(`✓ Found ${displayCourses.length} course(s).`));

  // Calculate content width, capped to terminal width
  // Display courses table - flex will adapt to terminal width
  const table = new Table([
    { key: "name", header: "Course Name", flex: 1, minWidth: 15 },
  ]);
  displayCourses.forEach((course) => table.addRow({ name: course.name }));
  table.renderWithResize();

  const prompt = options.prompt || chalk.bold.cyan("\nEnter course number: ");
  const courseChoice = await askQuestion(rl, prompt);

  // Stop watching for resize after user input
  table.stopWatching();

  if (
    !courseChoice.trim() ||
    courseChoice === ".." ||
    courseChoice.toLowerCase() === "back"
  ) {
    console.log(chalk.red("No course selected. Exiting..."));
    rl.close();
    return null;
  }

  const courseIndex = parseInt(courseChoice) - 1;
  if (courseIndex < 0 || courseIndex >= displayCourses.length) {
    console.log(chalk.red("Invalid course selection."));
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
export function formatGrade(
  submission: any,
  pointsPossible: number,
): { text: string; color: (s: string) => string } {
  if (
    submission &&
    submission.score !== null &&
    submission.score !== undefined
  ) {
    const score =
      submission.score % 1 === 0
        ? Math.round(submission.score)
        : submission.score;
    const text = `${score}/${pointsPossible}`;
    const percentage = pointsPossible > 0 ? (score / pointsPossible) * 100 : 0;

    let color = chalk.white;
    if (percentage >= 80) color = chalk.green;
    else if (percentage >= 50) color = chalk.yellow;
    else color = chalk.red;

    return { text, color };
  } else if (submission && submission.excused) {
    return { text: "Excused", color: chalk.blue };
  } else if (submission && submission.missing) {
    return { text: "Missing", color: chalk.red };
  } else if (pointsPossible) {
    return { text: `–/${pointsPossible}`, color: chalk.gray };
  }
  return { text: "N/A", color: chalk.gray };
}

/**
 * Format due date for display
 */
export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  return new Date(dueAt).toLocaleString();
}

/**
 * Display assignments in a formatted table
 */
export function displayAssignments(
  assignments: CanvasAssignment[],
  options: AssignmentDisplayOptions = {},
  logger?: (str: string) => void,
): void {
  const columns: ColumnDefinition[] = [
    {
      key: "name",
      header: "Assignment Name",
      flex: 1,
      minWidth: 15,
      maxWidth: 35,
    },
  ];

  if (options.showId) {
    columns.push({ key: "id", header: "ID", width: 8 });
  }

  if (options.showGrade) {
    columns.push({
      key: "grade",
      header: "Grade",
      width: 10,
      color: (value, row) => {
        const gradeInfo = formatGrade(row._submission, row._pointsPossible);
        return gradeInfo.color(value);
      },
    });
  }

  if (options.showDueDate) {
    columns.push({
      key: "dueDate",
      header: "Due Date",
      width: 16,
    });
  }

  if (options.showStatus) {
    columns.push({
      key: "status",
      header: "Status",
      width: 12,
      color: (value, row) => {
        return row._isSubmitted ? chalk.green(value) : chalk.yellow(value);
      },
    });
  }

  const table = new Table(columns);

  assignments.forEach((assignment) => {
    const submission = (assignment as any).submission;
    const gradeInfo = formatGrade(submission, assignment.points_possible || 0);
    const isSubmitted = !!(submission && submission.submitted_at);

    table.addRow({
      name: assignment.name,
      id: assignment.id,
      grade: gradeInfo.text,
      dueDate: formatDueDate(assignment.due_at),
      status: isSubmitted ? "✓ Submitted" : "Not submit",
      // Internal fields for color functions
      _submission: submission,
      _pointsPossible: assignment.points_possible || 0,
      _isSubmitted: isSubmitted,
    });
  });

  table.render(logger);
}

// ============================================================================
// Submit Assignment Display
// ============================================================================

/**
 * Get assignment type text based on submission_types and allowed_extensions
 */
function getAssignmentType(assignment: CanvasAssignment): string {
  if (
    !assignment.submission_types ||
    assignment.submission_types.length === 0
  ) {
    return "Unknown";
  }

  const types = assignment.submission_types;
  if (types.includes("online_quiz")) {
    return "Quiz";
  } else if (types.includes("online_upload")) {
    if (
      assignment.allowed_extensions &&
      assignment.allowed_extensions.length > 0
    ) {
      const extList = assignment.allowed_extensions.join(", ");
      return extList;
    }
    return "Any file";
  } else if (types.includes("online_text_entry")) {
    return "Text Entry";
  } else if (types.includes("online_url")) {
    return "URL";
  } else if (types.includes("external_tool")) {
    return "External Tool";
  } else if (types.includes("media_recording")) {
    return "Media";
  } else if (types[0]) {
    return types[0].replace(/_/g, " ");
  }
  return "Unknown";
}

/**
 * Display assignments for submission in a formatted table
 * Returns the table instance so caller can stop watching for resize
 */
export function displaySubmitAssignments(
  assignments: CanvasAssignment[],
): Table {
  const columns: ColumnDefinition[] = [
    { key: "name", header: "Assignment Name", flex: 1, minWidth: 15 },
    { key: "type", header: "Type", flex: 0.5, minWidth: 8 },
    { key: "dueDate", header: "Due", width: 14 },
    {
      key: "status",
      header: "Status",
      width: 14,
      color: (value, row) => {
        return row._isSubmitted ? chalk.green(value) : chalk.yellow(value);
      },
    },
  ];

  const table = new Table(columns);

  assignments.forEach((assignment) => {
    const submission = (assignment as any).submission;
    const isSubmitted = !!(submission && submission.submitted_at);

    // Format date as "DD/MM/YYYY"
    let dueDate = "No due date";
    if (assignment.due_at) {
      const d = new Date(assignment.due_at);
      dueDate = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    }

    table.addRow({
      name: assignment.name,
      type: getAssignmentType(assignment),
      dueDate: dueDate,
      status: isSubmitted ? "✓ Submitted" : "Not submitted",
      _isSubmitted: isSubmitted,
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
export function displayAnnouncements(
  announcements: CanvasAnnouncement[],
  verbose: boolean = false,
): Table {
  // Check if we need to show course column (when context_code is present)
  const showCourse = announcements.some((a) => a.context_code);

  const columns: ColumnDefinition[] = [
    { key: "title", header: "Title", flex: 1, minWidth: 15 },
    { key: "posted", header: "Posted", width: 10 },
  ];

  if (showCourse) {
    columns.splice(1, 0, {
      key: "course",
      header: "Course",
      flex: 0.5,
      minWidth: 12,
    });
  }

  if (verbose) {
    columns.push(
      { key: "id", header: "ID", width: 8 },
      { key: "author", header: "Author", width: 20 },
    );
  }

  const table = new Table(columns);

  announcements.forEach((announcement) => {
    const date = announcement.posted_at
      ? new Date(announcement.posted_at).toLocaleDateString()
      : "N/A";

    const row: any = {
      title: announcement.title || "Untitled",
      posted: date,
    };

    if (showCourse && announcement.context_code) {
      // Extract course name from context_code (format: "course_12345")
      row.course = announcement.context_code.replace(/^course_/, "ID: ");
    }

    if (verbose) {
      row.id = announcement.id;
      row.author = announcement.author?.display_name || "Unknown";
    }

    table.addRow(row);
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
export function printSeparator(char: string = "─", length?: number): void {
  const width = length || process.stdout.columns || 60;
  console.log(chalk.cyan.bold(char.repeat(width)));
}

/**
 * Print a section header
 */
export function printHeader(title: string): void {
  console.log(chalk.cyan.bold("\n" + "─".repeat(60)));
  console.log(chalk.cyan.bold(title));
  console.log(chalk.cyan.bold("─".repeat(60)));
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
  // Parse HTML into DOM and extract text content
  const document = parseDocument(html);
  const text = textContent(document);

  return (
    text
      // Normalize multiple newlines to double newlines (paragraph breaks)
      .replace(/\n{3,}/g, "\n\n")
      // Normalize multiple spaces
      .replace(/[ \t]+/g, " ")
      // Trim each line
      .split("\n")
      .map((line: string) => line.trim())
      .join("\n")
      .trim()
  );
}

/**
 * Word-wrap text to fit within a given width
 */
function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push(""); // Preserve empty lines for paragraph breaks
      continue;
    }

    const words = paragraph.split(" ").filter((w) => w.length > 0);
    let currentLine = "";

    for (const word of words) {
      // Handle very long words by breaking them
      if (word.length > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
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
export function displayAnnouncementDetail(
  announcement: AnnouncementDetail,
): void {
  const terminalWidth = process.stdout.columns || 80;
  // Use most of terminal width, with some padding
  const boxWidth = Math.max(50, terminalWidth - 4);
  const contentWidth = boxWidth - 4; // 2 chars for border + 2 chars for padding

  const title = announcement.title || "Untitled";
  const date = announcement.postedAt
    ? new Date(announcement.postedAt).toLocaleString()
    : "N/A";
  const author = announcement.author || "Unknown";
  const cleanedMessage = cleanHtmlContent(announcement.message || "No content");

  // Wrap title if needed
  const titleLines = wordWrap(title, contentWidth);

  // Wrap message content
  const messageLines = wordWrap(cleanedMessage, contentWidth);

  // Helper to print a padded line
  const printLine = (
    content: string,
    style: (s: string) => string = chalk.white,
  ) => {
    const paddedContent = content.padEnd(contentWidth);
    console.log(chalk.gray("│ ") + style(paddedContent) + chalk.gray(" │"));
  };

  // Top border
  console.log("\n" + chalk.gray("╭" + "─".repeat(boxWidth - 2) + "╮"));

  // Title
  for (const line of titleLines) {
    printLine(line, chalk.bold.white);
  }

  // Separator
  console.log(chalk.gray("├" + "─".repeat(boxWidth - 2) + "┤"));

  // Metadata
  printLine(`Posted: ${date}`, chalk.gray);
  printLine(`Author: ${author}`, chalk.gray);

  // Separator
  console.log(chalk.gray("├" + "─".repeat(boxWidth - 2) + "┤"));

  // Message content
  for (const line of messageLines) {
    printLine(line, chalk.white);
  }

  // Bottom border
  console.log(chalk.gray("╰" + "─".repeat(boxWidth - 2) + "╯") + "\n");
}
