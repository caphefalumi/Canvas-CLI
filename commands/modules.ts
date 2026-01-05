/**
 * Modules command - Browse course modules and content
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  Table,
  pickCourse,
  printInfo,
  printSuccess,
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

function parseHtmlContent(html: string): string {
  if (!html) return "";

  let text = html;

  // Remove style and script tags with content - repeat until no more matches
  // This prevents attacks like <scr<script>ipt> which would leave <script> after one pass
  let prevText = "";
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*[^>]*>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*[^>]*>/gi, "");
  }

  // Now do standard HTML to text conversion
  text = text
    // Convert links to inline blue text with URL
    .replace(
      /<a.*?href="(.*?)[?"].*?>(.*?)<\/a.*?>/gi,
      (_match, url, linkText) => {
        return chalk.blue(`${linkText} (${url})`);
      },
    )
    // Replace <br> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace </p>, </div>, </li>, </h*> with newlines
    .replace(/<\/(p|div|li|h[1-6])\s*[^>]*>/gi, "\n")
    // Replace <li> with bullet
    .replace(/<li[^>]*>/gi, "• ")
    // Handle headers
    .replace(/<h[1-6][^>]*>/gi, "\n")
    // Remove remaining tags (handles malformed tags with spaces/attributes)
    .replace(/<\/?[a-z][^>]*>/gi, "");

  // Decode HTML entities in a safe order
  // First decode numeric entities
  text = text
    .replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    });

  // Then decode named entities (only most common ones to avoid issues)
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // Ampersand MUST be last

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching modules:"), errorMessage);
    process.exit(1);
  }
}
