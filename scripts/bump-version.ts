#!/usr/bin/env bun
/**
 * Version bump script
 * Updates version in package.json and src/index.ts
 * Usage: bun scripts/bump-version.ts [major|minor|patch|<version>]
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

type BumpType = "major" | "minor" | "patch";

function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function bumpVersion(currentVersion: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(currentVersion);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${type}`);
  }
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function updatePackageJson(newVersion: string): void {
  const packagePath = join(process.cwd(), "package.json");
  const packageContent = readFileSync(packagePath, "utf-8");
  const packageJson = JSON.parse(packageContent);

  const oldVersion = packageJson.version;
  packageJson.version = newVersion;

  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`✓ Updated package.json: ${oldVersion} → ${newVersion}`);
}

function updateIndexTs(newVersion: string): void {
  const indexPath = join(process.cwd(), "src", "index.ts");
  const content = readFileSync(indexPath, "utf-8");

  // Match the version in .version() call (handles multiple parameters)
  const versionRegex = /\.version\(["'](\d+\.\d+\.\d+)["']/;
  const match = content.match(versionRegex);

  if (!match) {
    throw new Error("Could not find version in src/index.ts");
  }

  const oldVersion = match[1];
  const newContent = content.replace(
    versionRegex,
    `.version("${newVersion}"`,
  );

  writeFileSync(indexPath, newContent);
  console.log(`✓ Updated src/index.ts: ${oldVersion} → ${newVersion}`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun scripts/bump-version.ts [major|minor|patch|<version>]");
    console.error("");
    console.error("Examples:");
    console.error("  bun scripts/bump-version.ts patch    # 1.9.0 → 1.9.1");
    console.error("  bun scripts/bump-version.ts minor    # 1.9.0 → 1.10.0");
    console.error("  bun scripts/bump-version.ts major    # 1.9.0 → 2.0.0");
    console.error("  bun scripts/bump-version.ts 2.0.0    # Set to 2.0.0");
    process.exit(1);
  }

  const input = args[0];

  // Read current version from package.json
  const packagePath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
  const currentVersion = packageJson.version;

  let newVersion: string;

  if (["major", "minor", "patch"].includes(input)) {
    newVersion = bumpVersion(currentVersion, input as BumpType);
  } else {
    // Direct version specification
    if (!isValidVersion(input)) {
      console.error(`Error: Invalid version format "${input}"`);
      console.error("Version must be in format: X.Y.Z (e.g., 1.9.1)");
      process.exit(1);
    }
    newVersion = input;
  }

  console.log(`\nBumping version: ${currentVersion} → ${newVersion}\n`);

  try {
    updatePackageJson(newVersion);
    updateIndexTs(newVersion);
    console.log(`\n✓ Version bumped successfully!\n`);
    console.log("Next steps:");
    console.log("  1. bun run build");
    console.log("  2. git add package.json src/index.ts");
    console.log(`  3. git commit -m "chore: bump version to ${newVersion}"`);
    console.log("  4. git push");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Error: ${errorMessage}\n`);
    process.exit(1);
  }
}

main();
