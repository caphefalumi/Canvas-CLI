/**
 * Files command - Browse and download course files
 */

import { makeCanvasRequest, getCanvasCourse } from "../lib/api-client.js";
import {
  pickCourse,
  Table,
  printInfo,
  printError,
  printSuccess,
  printSeparator,
} from "../lib/display.js";
import { createReadlineInterface, askQuestion } from "../lib/interactive.js";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import type {
  CanvasCourse,
  CanvasFile,
  CanvasFolder,
  ShowFilesOptions,
} from "../types/index.js";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
}

function getFileIcon(contentType: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // By extension first
  const extIcons: Record<string, string> = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📽️",
    pptx: "📽️",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    mp4: "🎬",
    mov: "🎬",
    avi: "🎬",
    mp3: "🎵",
    wav: "🎵",
    py: "🐍",
    js: "📜",
    ts: "📜",
    java: "☕",
    c: "⚙️",
    cpp: "⚙️",
    h: "⚙️",
    html: "🌐",
    css: "🎨",
    txt: "📃",
    md: "📃",
  };

  if (extIcons[ext]) return extIcons[ext];

  // By content type
  if (contentType.includes("image")) return "🖼️";
  if (contentType.includes("video")) return "🎬";
  if (contentType.includes("audio")) return "🎵";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("zip") || contentType.includes("compressed"))
    return "📦";
  if (contentType.includes("text")) return "📃";

  return "📁";
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });

    file.on("error", (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// Browse folder function for interactive navigation (exported for potential future use)
export async function browseFolder(
  courseId: string,
  folderId: string | null,
  courseName: string,
  folderPath: string = "/",
): Promise<void> {
  const rl = createReadlineInterface();

  try {
    // Get folders and files in current location
    let folders: CanvasFolder[] = [];
    let files: CanvasFile[] = [];

    if (folderId) {
      // Get subfolders and files in specific folder
      const [folderResult, fileResult] = await Promise.all([
        makeCanvasRequest<CanvasFolder[]>(
          "get",
          `folders/${folderId}/folders`,
          ["per_page=100"],
        ),
        makeCanvasRequest<CanvasFile[]>("get", `folders/${folderId}/files`, [
          "per_page=100",
        ]),
      ]);
      folders = folderResult || [];
      files = fileResult || [];
    } else {
      // Get root folders for course
      const rootFolders = await makeCanvasRequest<CanvasFolder[]>(
        "get",
        `courses/${courseId}/folders`,
        ["per_page=100"],
      );
      // Find root folder (usually named "course files")
      const rootFolder = rootFolders?.find((f) => f.parent_folder_id === null);
      if (rootFolder) {
        const [folderResult, fileResult] = await Promise.all([
          makeCanvasRequest<CanvasFolder[]>(
            "get",
            `folders/${rootFolder.id}/folders`,
            ["per_page=100"],
          ),
          makeCanvasRequest<CanvasFile[]>(
            "get",
            `folders/${rootFolder.id}/files`,
            ["per_page=100"],
          ),
        ]);
        folders = folderResult || [];
        files = fileResult || [];
      }
    }

    // Display current location
    console.log(chalk.cyan.bold(`\n${courseName}`));
    console.log(chalk.gray(`   Path: ${folderPath}`));
    printSeparator("─", 60);

    // Build menu items
    const menuItems: Array<{
      type: "folder" | "file" | "back" | "exit";
      name: string;
      data?: CanvasFolder | CanvasFile;
    }> = [];

    // Add back option if not at root
    if (folderId) {
      menuItems.push({ type: "back", name: "📤 .. (Go back)" });
    }

    // Add folders
    folders
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((folder) => {
        menuItems.push({
          type: "folder",
          name: `📁 ${folder.name}/`,
          data: folder,
        });
      });

    // Add files
    files
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
      .forEach((file) => {
        const icon = getFileIcon(file.content_type, file.filename);
        const size = formatFileSize(file.size);
        menuItems.push({
          type: "file",
          name: `${icon} ${file.display_name} (${size})`,
          data: file,
        });
      });

    // Add exit option
    menuItems.push({ type: "exit", name: "❌ Exit" });

    if (folders.length === 0 && files.length === 0) {
      console.log(chalk.yellow("\n   (Empty folder)"));
    }

    // Display menu
    console.log("");
    menuItems.forEach((item, index) => {
      console.log(chalk.white(`  ${index + 1}. ${item.name}`));
    });
    console.log("");

    // Get user selection
    const answer = await askQuestion(rl, chalk.cyan("Select item (number): "));
    const selection = parseInt(answer.trim(), 10);

    if (isNaN(selection) || selection < 1 || selection > menuItems.length) {
      console.log(chalk.yellow("Invalid selection."));
      rl.close();
      return;
    }

    const selectedItem = menuItems[selection - 1]!;

    if (selectedItem.type === "exit") {
      console.log(chalk.gray("Exiting file browser."));
      rl.close();
      return;
    }

    if (selectedItem.type === "back") {
      rl.close();
      // Go up one level - this is simplified, would need parent tracking for full implementation
      console.log(chalk.gray("Going back..."));
      return;
    }

    if (selectedItem.type === "folder") {
      const folder = selectedItem.data as CanvasFolder;
      rl.close();
      await browseFolder(
        courseId,
        folder.id.toString(),
        courseName,
        `${folderPath}${folder.name}/`,
      );
      return;
    }

    if (selectedItem.type === "file") {
      const file = selectedItem.data as CanvasFile;
      console.log("");
      console.log(chalk.cyan("File Details:"));
      console.log(chalk.white(`  Name: ${file.display_name}`));
      console.log(chalk.white(`  Size: ${formatFileSize(file.size)}`));
      console.log(chalk.white(`  Type: ${file.content_type}`));
      console.log(chalk.white(`  Updated: ${formatDate(file.updated_at)}`));
      console.log("");

      const downloadAnswer = await askQuestion(
        rl,
        chalk.cyan("Download this file? (y/n): "),
      );

      if (downloadAnswer.toLowerCase() === "y") {
        const downloadPath = path.join(process.cwd(), file.display_name);
        console.log(chalk.yellow(`\nDownloading to: ${downloadPath}`));

        try {
          await downloadFile(file.url, downloadPath);
          printSuccess(`✓ Downloaded: ${file.display_name}`);
        } catch (err) {
          printError(`Failed to download: ${err}`);
        }
      }

      rl.close();
    }
  } catch (error) {
    rl.close();
    throw error;
  }
}

export async function showFiles(
  courseName?: string,
  options: ShowFilesOptions = {},
): Promise<void> {
  try {
    let course: CanvasCourse | undefined;

    if (!courseName) {
      const result = await pickCourse({
        title: "\nLoading your courses, please wait...",
        showAll: options.all,
      });
      if (!result) return;

      course = result.course;
      result.rl.close();
    } else {
      course = await getCanvasCourse(courseName);
      if (!course) {
        printError(`Course "${courseName}" not found.`);
        return;
      }
      printSuccess(`✓ Using course: ${course.name}`);
    }

    printSeparator("─", 60);
    printInfo("Loading course files...");

    // Get all files for the course (flat list)
    const files = await makeCanvasRequest<CanvasFile[]>(
      "get",
      `courses/${course.id}/files`,
      ["per_page=100", "sort=updated_at", "order=desc"],
    );

    if (!files || files.length === 0) {
      console.log(chalk.yellow("\nNo files found in this course."));
      return;
    }

    console.log(chalk.cyan.bold(`\nFiles in: ${course.name}`));
    console.log(chalk.gray(`   Total: ${files.length} file(s)`));
    printSeparator("─", 60);

    const table = new Table(
      [
        {
          key: "name",
          header: "Name",
          flex: 2,
          minWidth: 15,
          maxWidth: 45,
        },
        {
          key: "size",
          header: "Size",
          minWidth: 8,
          maxWidth: 12,
          align: "right" as const,
        },
        {
          key: "updated",
          header: "Updated",
          minWidth: 10,
          maxWidth: 12,
        },
        {
          key: "type",
          header: "Type",
          minWidth: 10,
          maxWidth: 20,
        },
      ],
      { title: "" },
    );

    files.forEach((file) => {
      table.addRow({
        name: file.display_name,
        size: formatFileSize(file.size),
        updated: formatDate(file.updated_at),
        type: file.content_type.split("/").pop() || file.content_type,
      });
    });

    table.render();

    // Offer download option
    const rl = createReadlineInterface();
    console.log("");
    const answer = await askQuestion(
      rl,
      chalk.cyan("Enter file number to download (or press Enter to skip): "),
    );

    if (answer.trim()) {
      const fileIndex = parseInt(answer.trim(), 10) - 1;
      if (fileIndex >= 0 && fileIndex < files.length) {
        const file = files[fileIndex]!;
        const downloadPath = path.join(process.cwd(), file.display_name);
        console.log(chalk.yellow(`\nDownloading: ${file.display_name}`));

        try {
          await downloadFile(file.url, downloadPath);
          printSuccess(`Downloaded to: ${downloadPath}`);
        } catch (err) {
          printError(`Failed to download: ${err}`);
        }
      } else {
        console.log(chalk.yellow("Invalid file number."));
      }
    }

    rl.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle permission errors gracefully
    if (
      errorMessage.includes("Access denied") ||
      errorMessage.includes("permission")
    ) {
      console.log(chalk.yellow("\nUnable to access files for this course."));
      console.log(
        chalk.gray("This course may have file access restricted or disabled."),
      );
      return;
    }

    console.error(chalk.red("Error:"), errorMessage);
  }
}
