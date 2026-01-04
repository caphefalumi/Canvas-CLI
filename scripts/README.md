# Scripts

Development and maintenance scripts for Canvas-CLI.

## bump-version.ts

Automatically updates the version number in both `package.json` and `src/index.ts`.

### Usage

```bash
# Using npm scripts (recommended)
bun run version:patch  # 1.9.2 → 1.9.3
bun run version:minor  # 1.9.2 → 1.10.0
bun run version:major  # 1.9.2 → 2.0.0

# Direct usage
bun scripts/bump-version.ts patch
bun scripts/bump-version.ts minor
bun scripts/bump-version.ts major
bun scripts/bump-version.ts 2.0.0  # Set specific version
```

### What it does

1. Updates the `version` field in `package.json`
2. Updates the `.version()` call in `src/index.ts`
3. Provides next steps for building, committing, and pushing

### After running

```bash
bun run build
git add package.json src/index.ts
git commit -m "chore: bump version to X.Y.Z"
git push
```
