/**
 * Modules command - Browse course modules and content
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  Table,
  pickCourse,
  printInfo,
  printError,
  printSuccess,
  ColumnDefinition,
} from "../lib/display.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import { exec } from "child_process";
import chalk from "chalk";
import type {
  CanvasCourse,
  CanvasModule,
  CanvasModuleItem,
  ModulesOptions,
} from "../types/index.js";

function openUrl(url: string): void {
  const platform = process.platform;
  let cmd: string;
  if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd);
}

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

  let text = html
    // Replace <br> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    // Replace </p>, </div>, </li>, </h*> with newlines
    .replace(/<\/(p|div|li|h[1-6])\s*[^>]*>/gi, "\n")
    // Replace <li> with bullet
    .replace(/<li[^>]*>/gi, "• ")
    // Handle headers
    .replace(/<h[1-6][^>]*>/gi, "\n")
    // Remove style and script tags with content (handle malformed closing tags)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*[^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*[^>]*>/gi, "")
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

function extractLinks(html: string): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = [];
  // Match <a href="url">text</a>
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    let text = match[2]?.trim() || url || "";
    // Clean up the text
    text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (url && text) {
      links.push({ text, url });
    }
  }
  return links;
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

    const termWidth = process.stdout.columns || 80;
    const boxWidth = Math.min(termWidth - 4, 100);

    // Title
    console.log(chalk.gray("\n╭" + "─".repeat(boxWidth - 2) + "╮"));
    console.log(
      chalk.gray("│ ") +
        chalk.cyan.bold(page.title.padEnd(boxWidth - 4)) +
        chalk.gray(" │"),
    );
    console.log(chalk.gray("├" + "─".repeat(boxWidth - 2) + "┤"));

    // Content
    const content = parseHtmlContent(page.body);
    const lines = content.split("\n");

    for (const line of lines) {
      // Word wrap long lines
      if (line.length > boxWidth - 4) {
        const words = line.split(" ");
        let currentLine = "";
        for (const word of words) {
          if ((currentLine + " " + word).length > boxWidth - 4) {
            console.log(
              chalk.gray("│ ") +
                chalk.white(currentLine.padEnd(boxWidth - 4)) +
                chalk.gray(" │"),
            );
            currentLine = word;
          } else {
            currentLine = currentLine ? currentLine + " " + word : word;
          }
        }
        if (currentLine) {
          console.log(
            chalk.gray("│ ") +
              chalk.white(currentLine.padEnd(boxWidth - 4)) +
              chalk.gray(" │"),
          );
        }
      } else {
        console.log(
          chalk.gray("│ ") +
            chalk.white(line.padEnd(boxWidth - 4)) +
            chalk.gray(" │"),
        );
      }
    }

    console.log(chalk.gray("╰" + "─".repeat(boxWidth - 2) + "╯"));

    // Extract and show links
    const links = extractLinks(page.body);
    if (links.length > 0) {
      console.log(chalk.cyan.bold("\n📎 Links in this page:"));
      links.forEach((link, idx) => {
        console.log(
          chalk.gray(`  ${idx + 1}.`) +
            " " +
            makeClickableLink(link.url, link.text),
        );
      });
    }
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
    let course: CanvasCourse | undefined;
    let courseId: number;

    if (!courseName) {
      const result = await pickCourse({
        title: "\nLoading your courses...",
        showAll: options.all,
      });
      if (!result) return;
      course = result.course;
      courseId = course.id;
      result.rl.close();
    } else {
      const { getCanvasCourse } = await import("../lib/api-client.js");
      const { createReadlineInterface } = await import("../lib/interactive.js");
      const rl = createReadlineInterface();
      course = await getCanvasCourse(courseName, rl);
      if (!course) {
        printError(`Course "${courseName}" not found.`);
        return;
      }
      courseId = course.id;
    }

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

    // Interactive item selection
    const rl = createReadlineInterface();
    console.log(
      chalk.gray(
        '\nEnter # to view, "o #" to open in browser, or Enter to quit:',
      ),
    );
    const choice = await askQuestion(rl, chalk.cyan("Item #: "));
    rl.close();

    if (!choice || choice.trim() === "") {
      return;
    }

    const openInBrowser = choice.toLowerCase().startsWith("o ");
    const numStr = openInBrowser ? choice.slice(2).trim() : choice.trim();
    const itemIndex = parseInt(numStr) - 1;

    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= allItems.length) {
      console.log(chalk.red("Invalid selection."));
      return;
    }

    const selected = allItems[itemIndex]!;
    const { item, url } = selected;

    if (openInBrowser) {
      if (url) {
        console.log(chalk.green(`Opening: ${item.title}`));
        openUrl(url);
      } else {
        console.log(chalk.yellow("No URL available."));
      }
    } else {
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
        console.log(
          chalk.cyan(`\n${getItemTypeIcon(item.type)} ${item.title}`),
        );
        console.log("   " + makeClickableLink(url, "Open in Canvas"));
      } else {
        console.log(chalk.yellow("No content available."));
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red("Error fetching modules:"), errorMessage);
    process.exit(1);
  }
}
