/**
 * Bulk Download command - Download all course files
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import {
  pickCourse,
  printInfo,
  printError,
  printSuccess,
  printSeparator,
} from "../lib/display.js";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import type { CanvasFile, CanvasFolder } from "../types/index.js";

interface DownloadOptions {
  all?: boolean;
  output?: string;
}

function sanitizeFileName(name: string): string {
  // Replace invalid characters with underscores
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

async function downloadFile(
  url: string,
  outputPath: string,
  fileName: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;

    const request = client.get(url, (response) => {
      // Handle redirects
      if (
        response.statusCode === 301 ||
        response.statusCode === 302 ||
        response.statusCode === 307 ||
        response.statusCode === 308
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, outputPath, fileName).then(resolve);
          return;
        }
      }

      if (response.statusCode !== 200) {
        console.log(
          chalk.red(
            `  ✗ Failed to download ${fileName}: HTTP ${response.statusCode}`,
          ),
        );
        resolve(false);
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        console.log(chalk.green(`  ✓ Downloaded: ${fileName}`));
        resolve(true);
      });

      fileStream.on("error", (err) => {
        fs.unlink(outputPath, () => {});
        console.log(
          chalk.red(`  ✗ Error downloading ${fileName}: ${err.message}`),
        );
        resolve(false);
      });
    });

    request.on("error", (err) => {
      console.log(
        chalk.red(`  ✗ Error downloading ${fileName}: ${err.message}`),
      );
      resolve(false);
    });
  });
}

async function getAllFolders(courseId: string): Promise<CanvasFolder[]> {
  try {
    const folders = await makeCanvasRequest<CanvasFolder[]>(
      "get",
      `courses/${courseId}/folders`,
      ["per_page=100"],
    );
    return folders || [];
  } catch {
    return [];
  }
}

async function getFilesInFolder(folderId: string): Promise<CanvasFile[]> {
  try {
    const files = await makeCanvasRequest<CanvasFile[]>(
      "get",
      `folders/${folderId}/files`,
      ["per_page=100"],
    );
    return files || [];
  } catch {
    return [];
  }
}

/**
 * Download all files from a course
 */
export async function bulkDownload(
  courseName?: string,
  options: DownloadOptions = {},
): Promise<void> {
  try {
    const result = await pickCourse({
      showAll: options.all,
      courseName: courseName,
    });

    if (!result) return;

    const course = result.course;
    const selectedCourseId = course.id.toString();
    result.rl.close();

    printSeparator("=");
    printInfo(`Downloading files from: ${course?.name || selectedCourseId}`);
    printSeparator("=");

    // Determine output directory
    const sanitizedCourseName = sanitizeFileName(
      course?.name || `course_${selectedCourseId}`,
    );
    const baseOutputDir = options.output || process.cwd();
    const outputDir = path.join(baseOutputDir, sanitizedCourseName);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(chalk.cyan(`\nOutput directory: ${outputDir}\n`));

    // Get all folders
    printInfo("Fetching folder structure...");
    const folders = await getAllFolders(selectedCourseId);

    if (folders.length === 0) {
      printError("No folders found in this course.");
      printInfo("\nThis course may have file access restricted or disabled.");
      return;
    }

    console.log(chalk.cyan(`Found ${folders.length} folder(s)\n`));

    let totalFiles = 0;
    let downloadedFiles = 0;
    let failedFiles = 0;

    // Download files from each folder
    for (const folder of folders) {
      const folderPath = folder.full_name || folder.name;
      const sanitizedPath = sanitizeFileName(folderPath);
      const folderOutputDir = path.join(outputDir, sanitizedPath);

      // Create folder directory
      if (!fs.existsSync(folderOutputDir)) {
        fs.mkdirSync(folderOutputDir, { recursive: true });
      }

      // Get files in folder
      const files = await getFilesInFolder(folder.id.toString());

      if (files.length > 0) {
        console.log(chalk.bold(`\n📁 ${folderPath} (${files.length} files):`));
        totalFiles += files.length;

        // Download each file
        for (const file of files) {
          const sanitizedFileName = sanitizeFileName(
            file.display_name || file.filename,
          );
          const filePath = path.join(folderOutputDir, sanitizedFileName);

          // Skip if file already exists
          if (fs.existsSync(filePath)) {
            console.log(
              chalk.gray(`  ⊙ Skipped (exists): ${sanitizedFileName}`),
            );
            downloadedFiles++;
            continue;
          }

          const success = await downloadFile(
            file.url,
            filePath,
            sanitizedFileName,
          );
          if (success) {
            downloadedFiles++;
          } else {
            failedFiles++;
          }
        }
      }
    }

    // Summary
    printSeparator("=");

    if (totalFiles === 0) {
      printError("No files found in any folder!");
      printInfo("\nThis course may have file access restricted or disabled.");
      printInfo("Please check the course settings or contact your instructor.");
      return;
    }

    console.log(chalk.white.bold("\nDownload Summary:\n"));
    console.log(chalk.cyan(`Total files found: ${totalFiles}`));
    console.log(chalk.green(`Successfully downloaded: ${downloadedFiles}`));
    if (failedFiles > 0) {
      console.log(chalk.red(`Failed: ${failedFiles}`));
    }
    console.log(chalk.cyan(`\nAll files saved to: ${outputDir}`));
    printSeparator("=");

    printSuccess("\nBulk download completed!");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printError(`Error during bulk download: ${errorMessage}`);
  }
}
