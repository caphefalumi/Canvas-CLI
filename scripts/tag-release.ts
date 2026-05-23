#!/usr/bin/env bun
/**
 * Create and push a git tag for the current package version.
 * Usage: bun scripts/tag-release.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

function run(command: string): string {
  return execSync(command, { encoding: "utf-8" }).trim();
}

function getPackageVersion(): string {
  const packagePath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
  const version = String(packageJson.version || "").trim();

  if (!version) {
    throw new Error("package.json version not found.");
  }

  return version;
}

function tagExists(tag: string): boolean {
  try {
    run(`git rev-parse --verify ${tag}`);
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  const version = getPackageVersion();
  const tag = `v${version}`;

  if (tagExists(tag)) {
    console.log(`✓ Tag ${tag} already exists. Skipping.`);
    return;
  }

  run(`git tag ${tag}`);
  run(`git push origin ${tag}`);

  console.log(`✓ Created and pushed tag ${tag}`);
}

main();
