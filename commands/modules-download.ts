/**
 * Modules Download command
 * Defaults to Canvas Content Exports (Package History) for bulk download.
 * Falls back to module-by-module API if no completed packages are found.
 */

import { makeCanvasRequest } from "../lib/api-client.js";
import { getInstanceConfig } from "../lib/config.js";
import {
  pickCourse,
  printError,
  printInfo,
  printSuccess,
} from "../lib/display.js";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import os from "os";
import { execSync } from "child_process";
import { convertToMarkdown } from "../lib/markdown.js";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasFile,
  CanvasModule,
  CanvasModuleItem,
  ModulesDownloadOptions,
} from "../types/index.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ContentExport {
  id: number;
  created_at: string;
  export_type: "common_cartridge" | "qti" | "zip";
  workflow_state: "created" | "exporting" | "exported" | "failed";
  attachment?: { url: string };
  progress_url?: string;
  user_id: number;
}

interface CanvasProgress {
  workflow_state: "queued" | "running" | "completed" | "failed";
  completion: number;
  [key: string]: any;
}

interface CanvasPage {
  title: string;
  body: string;
  url: string;
  html_url: string;
  [key: string]: any;
}

interface CanvasDiscussion {
  id: number;
  title: string;
  message: string;
  html_url: string;
  [key: string]: any;
}

interface CanvasQuiz {
  id: number;
  title: string;
  description: string;
  html_url: string;
  time_limit: number | null;
  question_count: number;
  points_possible: number;
  [key: string]: any;
}

interface ModuleWithItems {
  module: CanvasModule;
  items: CanvasModuleItem[];
}

interface DownloadStats {
  totalItems: number;
  downloadedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  markdownCreated: number;
}

interface FileDownloadTask {
  url: string;
  filePath: string;
  fileName: string;
  file: CanvasFile;
  dir: string;
}

interface ImsccModuleItem {
  contentType: string;
  title: string;
  identifierRef: string;
  position: number;
  indent: number;
}

interface ImsccModule {
  identifier: string;
  title: string;
  position: number;
  items: ImsccModuleItem[];
}

interface ExportStats {
  pages: number;
  files: number;
  failed: number;
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

class Semaphore {
  private queue: (() => void)[] = [];
  private count: number;

  constructor(limit: number) {
    this.count = limit;
  }

  acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.count++;
    }
  }
}

const DOWNLOAD_CONCURRENCY = 5;

// ─── Utilities ────────────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    const request = client.get(url, (response) => {
      if (
        response.statusCode === 301 ||
        response.statusCode === 302 ||
        response.statusCode === 307 ||
        response.statusCode === 308
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
      fileStream.on("error", (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });

    request.on("error", reject);
  });
}

// Download with Canvas auth header, following redirects to S3 without auth
async function downloadWithAuth(
  url: string,
  outputPath: string,
): Promise<void> {
  const { token } = getInstanceConfig();

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { Authorization: `Bearer ${token}` },
    };

    https.get(options, (response) => {
      if (
        response.statusCode === 301 ||
        response.statusCode === 302 ||
        response.statusCode === 307 ||
        response.statusCode === 308
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // Redirect to S3 — no auth needed
          downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
      fileStream.on("error", (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
  });
}

async function writeMarkdownFile(
  outputPath: string,
  title: string,
  body: string,
  sourceUrl?: string,
): Promise<void> {
  const header = title ? `# ${title}\n\n` : "";
  const footer = sourceUrl ? `\n\n---\nSource: ${sourceUrl}\n` : "\n";
  const content = `${header}${body || "(No content.)"}${footer}`;
  await fs.promises.writeFile(outputPath, content, "utf8");
}

function resolveMarkdownPath(
  baseDir: string,
  baseName: string,
  originalPath?: string,
): string {
  const mdName = `${sanitizeFileName(baseName)}.md`;
  const mdPath = path.join(baseDir, mdName);
  if (originalPath && path.resolve(originalPath) === path.resolve(mdPath)) {
    return path.join(baseDir, `${sanitizeFileName(baseName)}.converted.md`);
  }
  return mdPath;
}

async function convertFileToMarkdown(
  file: CanvasFile,
  downloadedPath: string,
  outputDir: string,
): Promise<boolean> {
  const baseName = path.parse(
    file.display_name || file.filename || "file",
  ).name;
  const mdPath = resolveMarkdownPath(outputDir, baseName, downloadedPath);

  try {
    const markdown = await convertToMarkdown(downloadedPath, {
      filename: file.display_name || file.filename,
      contentType: file.content_type,
    });
    if (!markdown) return false;
    await writeMarkdownFile(mdPath, baseName, markdown, file.url);
    return true;
  } catch {
    return false;
  }
}

// ─── XML Parsing (IMSCC) ──────────────────────────────────────────────────────

function xmlText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] ?? "").trim() : "";
}

function xmlBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "g");
  let m;
  while ((m = regex.exec(xml)) !== null) {
    blocks.push(m[0]);
  }
  return blocks;
}

function parseModuleMeta(xml: string): ImsccModule[] {
  const modules: ImsccModule[] = [];

  for (const block of xmlBlocks(xml, "module")) {
    const identifierMatch = block.match(/identifier="([^"]+)"/);
    const items: ImsccModuleItem[] = [];

    for (const itemBlock of xmlBlocks(block, "item")) {
      items.push({
        contentType: xmlText(itemBlock, "content_type"),
        title: xmlText(itemBlock, "title"),
        identifierRef: xmlText(itemBlock, "identifierref"),
        position: parseInt(xmlText(itemBlock, "position") || "0"),
        indent: parseInt(xmlText(itemBlock, "indent") || "0"),
      });
    }

    items.sort((a, b) => a.position - b.position);
    modules.push({
      identifier: identifierMatch ? (identifierMatch[1] ?? "") : "",
      title: xmlText(block, "title"),
      position: parseInt(xmlText(block, "position") || "0"),
      items,
    });
  }

  return modules.sort((a, b) => a.position - b.position);
}

function parseManifest(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  // Match both attribute orderings: identifier before href, and href before identifier
  const fwd = /<resource\b[^>]*\bidentifier="([^"]+)"[^>]*\bhref="([^"]+)"/g;
  const rev = /<resource\b[^>]*\bhref="([^"]+)"[^>]*\bidentifier="([^"]+)"/g;
  let m;
  while ((m = fwd.exec(xml)) !== null) {
    const id = m[1],
      href = m[2];
    if (id && href) map.set(id, href);
  }
  while ((m = rev.exec(xml)) !== null) {
    const href = m[1],
      id = m[2];
    if (id && href && !map.has(id)) map.set(id, href);
  }
  return map;
}

// ─── ZIP Extraction ───────────────────────────────────────────────────────────

async function extractZip(
  zipPath: string,
  extractDir: string,
): Promise<boolean> {
  await ensureDir(extractDir);

  const cmds =
    process.platform === "win32"
      ? [
          `powershell -NoProfile -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${extractDir}'"`,
          `tar -xf "${zipPath}" -C "${extractDir}"`,
        ]
      : [
          `unzip -q "${zipPath}" -d "${extractDir}"`,
          `tar -xf "${zipPath}" -C "${extractDir}"`,
        ];

  for (const cmd of cmds) {
    try {
      execSync(cmd, { stdio: "pipe" });
      return true;
    } catch {
      // try next command
    }
  }
  return false;
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await ensureDir(dest);
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDirRecursive(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }),
  );
}

// ─── Content Exports API ─────────────────────────────────────────────────────

async function listCompletedExports(
  courseId: number,
): Promise<ContentExport[]> {
  try {
    const exports = await makeCanvasRequest<ContentExport[]>(
      "get",
      `courses/${courseId}/content_exports`,
      ["per_page=20", "export_type=common_cartridge"],
    );
    return (exports || []).filter(
      (e) => e.workflow_state === "exported" && e.attachment?.url,
    );
  } catch {
    return [];
  }
}

async function pollExportProgress(progressId: string): Promise<boolean> {
  const maxAttempts = 72; // 6 minutes at 5s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const progress = await makeCanvasRequest<CanvasProgress>(
        "get",
        `progress/${progressId}`,
      );
      if (progress?.workflow_state === "completed") {
        process.stdout.write("\n");
        return true;
      }
      if (progress?.workflow_state === "failed") {
        process.stdout.write("\n");
        return false;
      }
      const pct = progress?.completion ?? 0;
      process.stdout.write(`\r  ${chalk.cyan(`Exporting... ${pct}%`)}   `);
    } catch {
      // keep polling on transient errors
    }
  }
  process.stdout.write("\n");
  return false;
}

async function triggerNewExport(
  courseId: number,
): Promise<ContentExport | null> {
  try {
    console.log(
      chalk.cyan("\n  Triggering new course export (common cartridge)..."),
    );
    const newExport = await makeCanvasRequest<ContentExport>(
      "post",
      `courses/${courseId}/content_exports`,
      [],
      JSON.stringify({
        export_type: "common_cartridge",
        skip_notifications: true,
      }),
    );

    if (!newExport) return null;

    if (newExport.progress_url) {
      const progressId = newExport.progress_url.split("/").pop();
      if (progressId) {
        const ok = await pollExportProgress(progressId);
        if (!ok) {
          printError("Export failed or timed out.");
          return null;
        }
      }
    }

    // Re-fetch to get the attachment URL
    const updated = await makeCanvasRequest<ContentExport>(
      "get",
      `courses/${courseId}/content_exports/${newExport.id}`,
    );
    return updated?.attachment?.url ? updated : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printError(`Could not trigger export: ${message}`);
    return null;
  }
}

// ─── IMSCC Processing ─────────────────────────────────────────────────────────

async function processExtractedImscc(
  extractDir: string,
  outputDir: string,
  toMd: boolean,
): Promise<ExportStats> {
  const stats: ExportStats = { pages: 0, files: 0, failed: 0 };

  const moduleMetaPath = path.join(
    extractDir,
    "course_settings",
    "module_meta.xml",
  );
  const manifestPath = path.join(extractDir, "imsmanifest.xml");

  if (!fs.existsSync(moduleMetaPath)) {
    console.log(
      chalk.yellow(
        "  No module structure found; copying extracted files as-is.",
      ),
    );
    await copyDirRecursive(extractDir, outputDir);
    return stats;
  }

  const moduleMetaXml = await fs.promises.readFile(moduleMetaPath, "utf8");
  const modules = parseModuleMeta(moduleMetaXml);

  let identifierMap = new Map<string, string>();
  if (fs.existsSync(manifestPath)) {
    const manifestXml = await fs.promises.readFile(manifestPath, "utf8");
    identifierMap = parseManifest(manifestXml);
  }

  console.log(chalk.cyan(`\n  Organizing ${modules.length} module(s)...\n`));

  for (const mod of modules) {
    const moduleIndex = String(mod.position).padStart(2, "0");
    const moduleDirName = sanitizeFileName(
      `${moduleIndex} - ${mod.title || "module"}`,
    );
    const moduleDir = path.join(outputDir, moduleDirName);
    await ensureDir(moduleDir);

    console.log(
      chalk.bold(
        `\n📁 ${moduleIndex} - ${mod.title} (${mod.items.length} item${mod.items.length === 1 ? "" : "s"})`,
      ),
    );

    let currentDir = moduleDir;

    for (const item of mod.items) {
      if (item.contentType === "SubHeader") {
        currentDir = path.join(moduleDir, sanitizeFileName(item.title));
        await ensureDir(currentDir);
        console.log(chalk.cyan(`  📂 ${item.title}`));
        continue;
      }

      const relFilePath = identifierMap.get(item.identifierRef);
      const srcPath = relFilePath ? path.join(extractDir, relFilePath) : null;
      const fileExists = srcPath && fs.existsSync(srcPath);

      // Wiki pages — always convert to markdown
      if (item.contentType === "WikiPage") {
        try {
          const html = fileExists
            ? await fs.promises.readFile(srcPath, "utf8")
            : "";
          const markdown = await convertToMarkdown(html, { isHtml: true });
          const mdPath = resolveMarkdownPath(currentDir, item.title);
          await writeMarkdownFile(mdPath, item.title, markdown);
          stats.pages++;
          console.log(chalk.green(`  ✓ Page: ${path.basename(mdPath)}`));
        } catch {
          stats.failed++;
          console.log(chalk.red(`  ✗ Failed page: ${item.title}`));
        }
        continue;
      }

      // File attachments — copy to module folder
      if (fileExists && srcPath && relFilePath) {
        const destName = sanitizeFileName(path.basename(relFilePath));
        const destPath = path.join(currentDir, destName);
        try {
          await fs.promises.copyFile(srcPath, destPath);
          stats.files++;
          console.log(chalk.green(`  ✓ File: ${destName}`));

          if (toMd) {
            const baseName = path.parse(destName).name;
            const mdPath = resolveMarkdownPath(currentDir, baseName, destPath);
            try {
              const markdown = await convertToMarkdown(destPath, {
                filename: destName,
              });
              if (markdown) {
                await writeMarkdownFile(mdPath, baseName, markdown);
                stats.pages++;
                console.log(
                  chalk.green(`  ✓ Converted: ${path.basename(mdPath)}`),
                );
              }
            } catch {
              // conversion not supported for this file type
            }
          }
        } catch {
          stats.failed++;
          console.log(chalk.red(`  ✗ Failed copy: ${destName}`));
        }
        continue;
      }

      // Non-file items (Assignment, Discussion, ExternalUrl, Quiz…) — save stub markdown
      if (item.title) {
        try {
          const mdPath = resolveMarkdownPath(currentDir, item.title);
          const body =
            item.contentType === "ExternalUrl"
              ? `[Open Link](${item.identifierRef})`
              : `Type: ${item.contentType}`;
          await writeMarkdownFile(mdPath, item.title, body);
          stats.pages++;
          console.log(
            chalk.green(`  ✓ ${item.contentType}: ${path.basename(mdPath)}`),
          );
        } catch {
          stats.failed++;
        }
      }
    }
  }

  return stats;
}

// ─── Export-based Download ────────────────────────────────────────────────────

async function downloadViaExport(
  course: CanvasCourse,
  exportItem: ContentExport,
  outputDir: string,
  toMd: boolean,
): Promise<void> {
  const exportDate = new Date(exportItem.created_at).toLocaleString();
  console.log(chalk.cyan(`\nUsing package export from: ${exportDate}`));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `canvas-${course.id}-`));
  const zipPath = path.join(tmpDir, "export.zip");
  const extractDir = path.join(tmpDir, "extracted");

  try {
    // Download the export package with auth
    process.stdout.write(chalk.cyan("\nDownloading export package..."));
    await downloadWithAuth(exportItem.attachment!.url, zipPath);
    const sizeKb = Math.round(fs.statSync(zipPath).size / 1024);
    process.stdout.write(chalk.green(` ✓ (${sizeKb} KB)\n`));

    // Extract
    process.stdout.write(chalk.cyan("Extracting..."));
    const extracted = await extractZip(zipPath, extractDir);

    if (!extracted) {
      process.stdout.write("\n");
      // Save the zip for manual extraction
      const savedZip = path.join(
        outputDir,
        `${sanitizeFileName(course.name)}-export.zip`,
      );
      await fs.promises.copyFile(zipPath, savedZip);
      console.log(
        chalk.yellow(`\n  Extraction failed. Package saved to:\n  ${savedZip}`),
      );
      console.log(
        chalk.yellow("  Extract it manually to access course content."),
      );
      return;
    }
    process.stdout.write(chalk.green(" ✓\n"));

    // Organize into module folder structure
    const stats = await processExtractedImscc(extractDir, outputDir, toMd);

    printInfo("\n" + "-".repeat(60));
    console.log(chalk.white.bold("\nExport Download Summary:\n"));
    console.log(chalk.green(`Pages/markdown created: ${stats.pages}`));
    console.log(chalk.green(`Files organized: ${stats.files}`));
    if (stats.failed > 0) {
      console.log(chalk.red(`Failed: ${stats.failed}`));
    }
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ─── Module-by-module API fallback ───────────────────────────────────────────

async function runConcurrentDownloads(
  tasks: FileDownloadTask[],
  stats: DownloadStats,
  toMd: boolean,
): Promise<void> {
  if (tasks.length === 0) return;

  console.log(
    chalk.cyan(
      `\nDownloading ${tasks.length} file(s) (up to ${DOWNLOAD_CONCURRENCY} at a time)...\n`,
    ),
  );

  const sem = new Semaphore(DOWNLOAD_CONCURRENCY);

  const runTask = async (task: FileDownloadTask): Promise<void> => {
    await sem.acquire();
    try {
      if (fs.existsSync(task.filePath)) {
        stats.skippedFiles++;
        console.log(chalk.gray(`  ⊙ Skipped (exists): ${task.fileName}`));
        return;
      }

      await downloadFile(task.url, task.filePath);
      stats.downloadedFiles++;
      console.log(chalk.green(`  ✓ Downloaded: ${task.fileName}`));

      if (toMd) {
        const converted = await convertFileToMarkdown(
          task.file,
          task.filePath,
          task.dir,
        );
        if (converted) {
          stats.markdownCreated++;
          const baseName = path.parse(task.fileName).name;
          console.log(chalk.green(`  ✓ Converted to markdown: ${baseName}`));
        }
      }
    } catch (error) {
      stats.failedFiles++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red(`  ✗ Failed: ${task.fileName} (${message})`));
    } finally {
      sem.release();
    }
  };

  await Promise.all(tasks.map(runTask));
}

async function fetchModulesWithItems(
  courseId: number,
): Promise<ModuleWithItems[]> {
  const modules = await makeCanvasRequest<CanvasModule[]>(
    "get",
    `courses/${courseId}/modules`,
    ["per_page=100"],
  );

  if (!modules || modules.length === 0) return [];

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

  return Promise.all(itemPromises);
}

async function downloadViaModuleApi(
  course: CanvasCourse,
  outputDir: string,
  options: ModulesDownloadOptions,
): Promise<void> {
  const courseId = course.id;
  const modulesWithItems = await fetchModulesWithItems(courseId);

  if (modulesWithItems.length === 0) {
    printError("No modules found for this course.");
    return;
  }

  const stats: DownloadStats = {
    totalItems: 0,
    downloadedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    markdownCreated: 0,
  };

  const fileDownloadQueue: FileDownloadTask[] = [];

  for (const { module, items } of modulesWithItems) {
    if (items.length === 0) continue;

    const moduleIndex = String(module.position).padStart(2, "0");
    const moduleDirName = sanitizeFileName(
      `${moduleIndex} - ${module.name || "module"}`,
    );
    const moduleDir = path.join(outputDir, moduleDirName);
    await ensureDir(moduleDir);
    let currentSectionDir = moduleDir;

    console.log(
      chalk.bold(
        `\n📁 ${moduleIndex} - ${module.name} (${items.length} item${items.length === 1 ? "" : "s"})`,
      ),
    );

    for (const item of items) {
      stats.totalItems++;
      const itemTitle = item.title || `item_${item.id}`;

      if (item.type === "SubHeader") {
        const sectionDirName = sanitizeFileName(itemTitle);
        currentSectionDir = path.join(moduleDir, sectionDirName);
        await ensureDir(currentSectionDir);
        console.log(chalk.cyan(`  📂 ${itemTitle}`));
        continue;
      }

      if (item.type === "Page" && item.page_url) {
        try {
          const page = await makeCanvasRequest<CanvasPage>(
            "get",
            `courses/${courseId}/pages/${item.page_url}`,
          );
          const markdownPath = resolveMarkdownPath(
            currentSectionDir,
            itemTitle,
          );
          const markdown = await convertToMarkdown(page?.body || "", {
            isHtml: true,
          });
          await writeMarkdownFile(
            markdownPath,
            page?.title || itemTitle,
            markdown,
            page?.html_url,
          );
          stats.markdownCreated++;
          console.log(chalk.green(`  ✓ Page: ${path.basename(markdownPath)}`));
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(chalk.red(`  ✗ Failed page: ${itemTitle} (${message})`));
        }
        continue;
      }

      if (item.type === "Assignment" && item.content_id) {
        try {
          const assignment = await makeCanvasRequest<CanvasAssignment>(
            "get",
            `courses/${courseId}/assignments/${item.content_id}`,
          );
          const markdownPath = resolveMarkdownPath(
            currentSectionDir,
            itemTitle,
          );
          const descMarkdown = await convertToMarkdown(
            assignment?.description || "",
            { isHtml: true },
          );
          const metaLines = [
            descMarkdown || "(No description)",
            assignment?.due_at
              ? `\nDue: ${new Date(assignment.due_at).toLocaleString()}`
              : "",
            assignment?.points_possible != null
              ? `Points: ${assignment.points_possible}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
          await writeMarkdownFile(
            markdownPath,
            assignment?.name || itemTitle,
            metaLines,
            assignment?.html_url || item.html_url,
          );
          stats.markdownCreated++;
          console.log(
            chalk.green(`  ✓ Assignment: ${path.basename(markdownPath)}`),
          );
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(
            chalk.red(`  ✗ Failed assignment: ${itemTitle} (${message})`),
          );
        }
        continue;
      }

      if (item.type === "Discussion" && item.content_id) {
        try {
          const discussion = await makeCanvasRequest<CanvasDiscussion>(
            "get",
            `courses/${courseId}/discussion_topics/${item.content_id}`,
          );
          const markdownPath = resolveMarkdownPath(
            currentSectionDir,
            itemTitle,
          );
          const markdown = await convertToMarkdown(discussion?.message || "", {
            isHtml: true,
          });
          await writeMarkdownFile(
            markdownPath,
            discussion?.title || itemTitle,
            markdown,
            discussion?.html_url || item.html_url,
          );
          stats.markdownCreated++;
          console.log(
            chalk.green(`  ✓ Discussion: ${path.basename(markdownPath)}`),
          );
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(
            chalk.red(`  ✗ Failed discussion: ${itemTitle} (${message})`),
          );
        }
        continue;
      }

      if (item.type === "Quiz" && item.content_id) {
        try {
          const quiz = await makeCanvasRequest<CanvasQuiz>(
            "get",
            `courses/${courseId}/quizzes/${item.content_id}`,
          );
          const markdownPath = resolveMarkdownPath(
            currentSectionDir,
            itemTitle,
          );
          const descMarkdown = await convertToMarkdown(
            quiz?.description || "",
            { isHtml: true },
          );
          const details = [
            descMarkdown || "(No description)",
            quiz?.time_limit ? `\nTime Limit: ${quiz.time_limit} minutes` : "",
            quiz?.question_count ? `Questions: ${quiz.question_count}` : "",
            quiz?.points_possible != null
              ? `Points: ${quiz.points_possible}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");
          await writeMarkdownFile(
            markdownPath,
            quiz?.title || itemTitle,
            details,
            quiz?.html_url || item.html_url,
          );
          stats.markdownCreated++;
          console.log(chalk.green(`  ✓ Quiz: ${path.basename(markdownPath)}`));
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(chalk.red(`  ✗ Failed quiz: ${itemTitle} (${message})`));
        }
        continue;
      }

      if (item.type === "ExternalUrl" || item.type === "ExternalTool") {
        try {
          const markdownPath = resolveMarkdownPath(
            currentSectionDir,
            itemTitle,
          );
          const link = item.external_url || item.html_url || "";
          const body = link ? `[Open Link](${link})` : "(No link available)";
          await writeMarkdownFile(
            markdownPath,
            itemTitle,
            body,
            link || undefined,
          );
          stats.markdownCreated++;
          console.log(chalk.green(`  ✓ Link: ${path.basename(markdownPath)}`));
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(chalk.red(`  ✗ Failed link: ${itemTitle} (${message})`));
        }
        continue;
      }

      if (item.type === "File" && item.content_id) {
        try {
          const file = await makeCanvasRequest<CanvasFile>(
            "get",
            `files/${item.content_id}`,
          );

          if (!file?.url) {
            stats.skippedFiles++;
            console.log(chalk.yellow(`  ⊙ Skipped (no url): ${itemTitle}`));
            continue;
          }

          const rawName = file.display_name || file.filename || itemTitle;
          const fileName = sanitizeFileName(rawName);
          const filePath = path.join(currentSectionDir, fileName);

          fileDownloadQueue.push({
            url: file.url,
            filePath,
            fileName,
            file,
            dir: currentSectionDir,
          });
          console.log(chalk.gray(`  ↓ Queued: ${fileName}`));
        } catch (error) {
          stats.failedFiles++;
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(
            chalk.red(`  ✗ Failed to queue: ${itemTitle} (${message})`),
          );
        }
        continue;
      }
    }
  }

  await runConcurrentDownloads(fileDownloadQueue, stats, options.toMd || false);

  printInfo("\n" + "-".repeat(60));
  console.log(chalk.white.bold("\nModule Download Summary:\n"));
  console.log(chalk.cyan(`Total items processed: ${stats.totalItems}`));
  console.log(chalk.green(`Files downloaded: ${stats.downloadedFiles}`));
  console.log(chalk.green(`Markdown/pages created: ${stats.markdownCreated}`));
  if (stats.skippedFiles > 0)
    console.log(chalk.yellow(`Skipped: ${stats.skippedFiles}`));
  if (stats.failedFiles > 0)
    console.log(chalk.red(`Failed: ${stats.failedFiles}`));
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

async function downloadModulesContent(
  course: CanvasCourse,
  options: ModulesDownloadOptions,
): Promise<void> {
  const courseId = course.id;

  const baseOutputDir = options.output || process.cwd();
  const courseDirName = sanitizeFileName(course.name || `course_${courseId}`);
  const outputDir = path.join(baseOutputDir, courseDirName);
  await ensureDir(outputDir);

  console.log(chalk.cyan(`\nOutput directory: ${outputDir}\n`));

  printInfo("-".repeat(60));

  // ── Step 1: Check for existing package exports ──────────────────────────────
  if (!options.noPackage) {
    process.stdout.write(chalk.cyan("Checking for existing course exports..."));
    const exports = await listCompletedExports(courseId);
    process.stdout.write(
      exports.length > 0
        ? chalk.green(` Found ${exports.length}\n`)
        : chalk.yellow(" None found\n"),
    );

    const latest = exports[0];
    if (latest) {
      // Show available exports (informational)
      if (exports.length > 1) {
        console.log(chalk.cyan("\nAvailable package exports:"));
        exports.forEach((e, i) => {
          const date = new Date(e.created_at).toLocaleString();
          const marker = i === 0 ? chalk.green(" ← using this") : "";
          console.log(
            `  ${i + 1}. ${e.export_type.replace("_", " ")} — ${date}${marker}`,
          );
        });
      }

      await downloadViaExport(course, latest, outputDir, options.toMd || false);
      printSuccess(`\nAll module content saved to: ${outputDir}`);
      return;
    }
  }

  // ── Step 2: Offer to trigger a new export ───────────────────────────────────
  if (!options.noPackage) {
    console.log(
      chalk.yellow(
        "\nNo existing exports found. Triggering a new course export...",
      ),
    );
    const newExport = await triggerNewExport(courseId);

    if (newExport) {
      await downloadViaExport(
        course,
        newExport,
        outputDir,
        options.toMd || false,
      );
      printSuccess(`\nAll module content saved to: ${outputDir}`);
      return;
    }

    console.log(
      chalk.yellow(
        "\nCould not create export. Falling back to module-by-module API...",
      ),
    );
  }

  // ── Step 3: Module-by-module API fallback ───────────────────────────────────
  printInfo("Downloading module content via API...");
  await downloadViaModuleApi(course, outputDir, options);
  printSuccess(`\nAll module content saved to: ${outputDir}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function downloadModules(
  courseName?: string,
  options: ModulesDownloadOptions = {},
): Promise<void> {
  try {
    const result = await pickCourse({
      showAll: options.all,
      courseName: courseName,
    });

    if (!result) return;

    const course = result.course;
    result.rl.close();

    await downloadModulesContent(course, options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printError(`Error during module download: ${errorMessage}`);
  }
}
