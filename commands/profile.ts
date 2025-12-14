/**
 * Profile command
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import chalk from "chalk";
import type { CanvasUser } from "../types/index.js";

interface ProfileOptions {
  verbose?: boolean;
}

function pad(str: string, len: number): string {
  return str + " ".repeat(Math.max(0, len - str.length));
}

export async function showProfile(options: ProfileOptions = {}): Promise<void> {
  try {
    console.log(chalk.cyan.bold("\nLoading profile, please wait..."));
    const user = await makeCanvasRequest<CanvasUser>("get", "users/self", [
      "include[]=email",
      "include[]=locale",
    ]);

    console.log(chalk.green("Profile loaded successfully."));

    // Prepare profile data
    const basicFields: [string, string][] = [
      ["Name", user.name || "N/A"],
      ["ID", String(user.id)],
      ["Email", user.email || "N/A"],
      ["Login ID", user.login_id || "N/A"],
    ];

    const verboseFields: [string, string][] = [
      ["Short Name", user.short_name || "N/A"],
      ["Sortable Name", user.sortable_name || "N/A"],
      ["Locale", (user as any).locale || "N/A"],
      ["Time Zone", (user as any).time_zone || "N/A"],
      [
        "Created",
        (user as any).created_at
          ? new Date((user as any).created_at).toLocaleString()
          : "N/A",
      ],
    ];

    const fields = options.verbose
      ? [...basicFields, ...verboseFields]
      : basicFields;

    // Calculate adaptive column widths based on terminal size
    const termWidth = process.stdout.columns || 80;
    const borderOverhead = 7; // │ + │ + │ and spaces
    const available = Math.max(40, termWidth - borderOverhead);

    // Calculate based on content with proportional distribution
    const maxLabelLen = Math.max(5, ...fields.map((f) => f[0].length));
    const maxValueLen = Math.max(5, ...fields.map((f) => f[1].length));

    // Distribute width: labels ~30%, values ~70% (values are usually longer)
    const colLabel = Math.max(
      maxLabelLen + 1,
      Math.min(20, Math.floor(available * 0.3)),
    );
    const colValue = Math.max(maxValueLen + 1, available - colLabel);

    // Top border (rounded)
    console.log(
      chalk.gray("╭─") +
        chalk.gray("─".repeat(colLabel)) +
        chalk.gray("┬─") +
        chalk.gray("─".repeat(colValue)) +
        chalk.gray("╮"),
    );

    // Header
    console.log(
      chalk.gray("│ ") +
        chalk.cyan.bold(pad("Field", colLabel)) +
        chalk.gray("│ ") +
        chalk.cyan.bold(pad("Value", colValue)) +
        chalk.gray("│"),
    );

    // Header separator
    console.log(
      chalk.gray("├─") +
        chalk.gray("─".repeat(colLabel)) +
        chalk.gray("┼─") +
        chalk.gray("─".repeat(colValue)) +
        chalk.gray("┤"),
    );

    // Rows
    fields.forEach(([label, value]) => {
      // Truncate value if too long
      let displayValue = value;
      if (displayValue.length > colValue) {
        displayValue = displayValue.substring(0, colValue - 3) + "...";
      }
      console.log(
        chalk.gray("│ ") +
          chalk.white(pad(label, colLabel)) +
          chalk.gray("│ ") +
          chalk.white(pad(displayValue, colValue)) +
          chalk.gray("│"),
      );
    });

    // Bottom border (rounded)
    console.log(
      chalk.gray("╰─") +
        chalk.gray("─".repeat(colLabel)) +
        chalk.gray("┴─") +
        chalk.gray("─".repeat(colValue)) +
        chalk.gray("╯"),
    );

    // Show avatar URL separately if verbose (it's usually long)
    if (options.verbose && user.avatar_url) {
      console.log(chalk.gray("\nAvatar URL: ") + chalk.dim(user.avatar_url));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error: Failed to fetch profile: ") + errorMessage);
    process.exit(1);
  }
}
