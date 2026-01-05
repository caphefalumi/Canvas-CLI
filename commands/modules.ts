/**
 * Modules command - Browse course modules and content
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  Table,
  pickCourse,
  printInfo,
  printSuccess,
  parseHtmlContent,
  ColumnDefinition,
} from "../lib/display.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import chalk from "chalk";
import type {
  CanvasModule,
  CanvasModuleItem,
  ModulesOptions,
} from "../types/index.js";

function makeClickableLink(url: string, text?: string): string {
  const displayText = text || url;
  // OSC 8 hyperlink: \x1b]8;;URL\x07TEXT\x1b]8;;\x07
  return `\x1b]8;;${url}\x07${chalk.blue.underline(displayText)}\x1b]8;;\x07`;
}

interface CanvasPage {
  title: string;
  body: string;
  url: string;
  html_url: string;
  [key: string]: any;
}

async function displayPageContent(
  courseId: number,
  pageUrl: string,
): Promise<void> {
  try {
    const page = await makeCanvasRequest<CanvasPage>(
      "get",
      `courses/${courseId}/pages/${pageUrl}`,
    );

    if (!page) {
      console.log(chalk.yellow("Could not load page content."));
      return;
    }

    // Title
    console.log(chalk.cyan.bold(`\n${page.title}`));
    // Content
    const content = parseHtmlContent(page.body);
    console.log(`\n${content}\n`);
  } catch {
    console.log(chalk.yellow("Could not load page content."));
  }
}

function getItemTypeIcon(type: string): string {
  switch (type) {
    case "File":
      return "📄";
    case "Page":
      return "📝";
    case "Discussion":
      return "💬";
    case "Assignment":
      return "📋";
    case "Quiz":
      return "❓";
    case "SubHeader":
      return "📁";
    case "ExternalUrl":
      return "🔗";
    case "ExternalTool":
      return "🔧";
    default:
      return "📌";
  }
}

interface AllItem {
  module: CanvasModule;
  item: CanvasModuleItem;
  url: string;
}

export async function showModules(
  courseName?: string,
  options: ModulesOptions = {},
): Promise<void> {
  try {
    const result = await pickCourse({
      showAll: options.all,
      courseName: courseName,
    });

    if (!result) return;

    const course = result.course;
    const courseId = course.id;
    result.rl.close();

    printInfo("\n" + "-".repeat(60));
    printInfo("Loading course content...");

    const modules = await makeCanvasRequest<CanvasModule[]>(
      "get",
      `courses/${courseId}/modules`,
      ["per_page=100"],
    );

    if (!modules || modules.length === 0) {
      console.log(chalk.yellow("\nNo modules found for this course."));
      return;
    }

    // Fetch all items from all modules in parallel
    const itemPromises = modules.map(async (mod) => {
      try {
        const items = await makeCanvasRequest<CanvasModuleItem[]>(
          "get",
          `courses/${courseId}/modules/${mod.id}/items`,
          ["per_page=100"],
        );
        return { module: mod, items: items || [] };
      } catch {
        return { module: mod, items: [] };
      }
    });

    const results = await Promise.all(itemPromises);

    // Flatten all items with module info
    const allItems: AllItem[] = [];
    for (const { module: mod, items } of results) {
      for (const item of items) {
        const url = item.html_url || item.external_url || "";
        allItems.push({ module: mod, item, url });
      }
    }

    if (allItems.length === 0) {
      console.log(chalk.yellow("\nNo content found in this course."));
      return;
    }

    console.log(chalk.cyan.bold(`\nContent for: ${course?.name}`));
    printSuccess(
      `Found ${allItems.length} item(s) across ${modules.length} module(s).`,
    );

    // Create readline interface for user input
    const rl = createReadlineInterface();

    const columns: ColumnDefinition[] = [
      { key: "module", header: "Module", flex: 1, minWidth: 15 },
      { key: "title", header: "Title", flex: 2, minWidth: 30 },
    ];

    if (options.verbose) {
      columns.push(
        { key: "type", header: "Type", width: 12 },
        { key: "id", header: "ID", width: 8 },
      );
    }

    const table = new Table(columns, {
      showRowNumbers: true,
    });

    for (const entry of allItems) {
      const { module: mod, item } = entry;

      const row: any = {
        module: mod.name,
        title: item.title,
      };

      if (options.verbose) {
        row.type = item.type || "N/A";
        row.id = item.id;
      }

      table.addRow(row);
    }

    table.renderWithResize();

    // Interactive item selection - same style as announcements
    const choice = await askQuestion(
      rl,
      chalk.bold.cyan(
        "\nEnter module item number to view details (0 to exit): ",
      ),
    );

    // Stop watching for resize after user input
    table.stopWatching();

    if (!choice.trim() || choice === "0") {
      rl.close();
      return;
    }

    const itemIndex = parseInt(choice) - 1;
    rl.close();

    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= allItems.length) {
      console.log(chalk.red("Invalid selection."));
      return;
    }

    const selected = allItems[itemIndex]!;
    const { item, url } = selected;

    // Display content based on type
    if (item.type === "Page" && item.page_url) {
      await displayPageContent(courseId, item.page_url);
    } else if (item.type === "File" && url) {
      console.log(chalk.cyan(`\n📄 File: ${item.title}`));
      console.log("   " + makeClickableLink(url, "Click to download"));
    } else if (item.type === "ExternalUrl" && item.external_url) {
      console.log(chalk.cyan(`\n🔗 External Link: ${item.title}`));
      console.log("   " + makeClickableLink(item.external_url));
    } else if (url) {
      console.log(chalk.cyan(`\n${getItemTypeIcon(item.type)} ${item.title}`));
      console.log("   " + makeClickableLink(url, "Open in Canvas"));
    } else {
      console.log(chalk.yellow("No content available."));
    }
    rl.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching modules:"), errorMessage);
    process.exit(1);
  }
}
