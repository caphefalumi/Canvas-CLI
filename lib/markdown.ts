import fs from "fs";
import path from "path";
import { htmlToText } from "html-to-text";
import textract from "textract";

interface ConvertOptions {
  filename?: string;
  contentType?: string;
  isHtml?: boolean;
}

function normalizeText(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function stripImagesFromText(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
}

function stripImageLineArtifacts(text: string): string {
  const imageLine = /^\s*(image|figure|graphic)\b.*$/i;
  return text
    .split("\n")
    .filter((line) => !imageLine.test(line))
    .join("\n")
    .trim();
}

function isHtmlContent(options: ConvertOptions, ext: string): boolean {
  if (options.isHtml) return true;
  if (options.contentType?.includes("html")) return true;
  return ext === ".html" || ext === ".htm";
}

function isPlainTextContent(options: ConvertOptions, ext: string): boolean {
  if (options.contentType?.startsWith("text/")) return true;
  return [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".log",
  ].includes(ext);
}

function extractTextFromFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    textract.fromFileWithPath(filePath, (error, text) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(text || "");
    });
  });
}

export async function convertToMarkdown(
  input: string,
  options: ConvertOptions = {},
): Promise<string> {
  const ext = path.extname(options.filename || input).toLowerCase();

  if (options.isHtml) {
    const text = htmlToText(input, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "svg", format: "skip" },
        { selector: "figure", format: "skip" },
        { selector: "picture", format: "skip" },
      ],
    });
    return stripImagesFromText(normalizeText(text));
  }
  if (ext === ".pdf" || options.contentType?.includes("pdf")) {
    const text = await extractTextFromFile(input);
    return stripImageLineArtifacts(normalizeText(text));
  }

  if (isHtmlContent(options, ext)) {
    const html = await fs.promises.readFile(input, "utf8");
    const text = htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "svg", format: "skip" },
        { selector: "figure", format: "skip" },
        { selector: "picture", format: "skip" },
      ],
    });
    return stripImageLineArtifacts(stripImagesFromText(normalizeText(text)));
  }

  if (isPlainTextContent(options, ext)) {
    const text = await extractTextFromFile(input);
    return stripImageLineArtifacts(normalizeText(text));
  }

  return "";
}
