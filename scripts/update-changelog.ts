#!/usr/bin/env bun
/**
 * Update CHANGELOG.md from git tags and commits.
 * Usage: bun scripts/update-changelog.ts [tag]
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function run(command: string): string {
  return execSync(command, { encoding: "utf-8" }).trim();
}

function getCurrentTag(): string {
  const fromEnv = process.env.GITHUB_REF_NAME?.trim();
  const fromArg = process.argv[2]?.trim();
  const tag = fromEnv || fromArg;

  if (!tag) {
    throw new Error(
      "Tag name not provided. Set GITHUB_REF_NAME or pass a tag.",
    );
  }

  return tag;
}

function getPreviousTag(currentTag: string): string | null {
  const tagsOutput = run("git tag --sort=-v:refname");
  if (!tagsOutput) {
    return null;
  }

  const tags = tagsOutput.split(/\r?\n/).filter(Boolean);
  const currentIndex = tags.indexOf(currentTag);
  if (currentIndex === -1) {
    return null;
  }

  const previous = tags[currentIndex + 1];
  return previous || null;
}

function getReleaseDate(tag: string): string {
  try {
    const date = run(`git log -1 --format=%cs ${tag}`);
    if (date) {
      return date;
    }
  } catch {
    // fall back to current date
  }

  return new Date().toISOString().slice(0, 10);
}

function getCommitMessages(
  previousTag: string | null,
  currentTag: string,
): string[] {
  let logCommand = "";

  if (previousTag) {
    logCommand = `git log ${previousTag}..${currentTag} --pretty=format:%s --no-merges`;
  } else {
    logCommand = `git log ${currentTag} --pretty=format:%s --no-merges`;
  }

  const output = run(logCommand);
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSection(
  version: string,
  date: string,
  messages: string[],
): string {
  const lines = messages.length > 0 ? messages : ["No changes recorded."];
  const bulletLines = lines.map((message) => `- ${message}`);

  return [
    `## [${version}] - ${date}`,
    "",
    "### Changed",
    "",
    ...bulletLines,
    "",
  ].join("\n");
}

function updateChangelog(section: string): void {
  const changelogPath = join(process.cwd(), "CHANGELOG.md");
  const content = readFileSync(changelogPath, "utf-8");

  const insertIndex = content.indexOf("\n## [");
  if (insertIndex === -1) {
    const nextContent = `${content.trim()}\n\n${section}`;
    writeFileSync(changelogPath, `${nextContent.trim()}\n`);
    return;
  }

  const before = content.slice(0, insertIndex).trimEnd();
  const after = content.slice(insertIndex).trimStart();
  const nextContent = `${before}\n\n${section}\n${after}`;

  writeFileSync(changelogPath, `${nextContent.trim()}\n`);
}

function main(): void {
  const tag = getCurrentTag();
  const displayVersion = tag.startsWith("v") ? tag.slice(1) : tag;
  const previousTag = getPreviousTag(tag);
  const releaseDate = getReleaseDate(tag);
  const messages = getCommitMessages(previousTag, tag);
  const section = buildSection(displayVersion, releaseDate, messages);

  updateChangelog(section);
  const rangeNote = previousTag ? `${previousTag}..${tag}` : tag;
  console.log(`✓ Updated CHANGELOG.md for ${displayVersion} (${rangeNote})`);
}

main();
