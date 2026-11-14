import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Each scenario gets its own process and home: never touch real Canvas credentials.
function scenario(body: string) {
  const home = mkdtempSync(join(tmpdir(), "canvas-rotation-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        "--eval",
        `
      import assert from 'node:assert/strict';
      import { getConfigPath, saveConfig, readConfig } from './lib/config.ts';
      import { rotateTokenIfNeeded } from './lib/token-rotation.ts';
      import { makeCanvasRequest } from './lib/api-client.ts';
      import { setConfigValue } from './commands/config.ts';
      assert.ok(getConfigPath().startsWith(process.env.HOME));
      const oldToken = 'abcde-original-secret';
      const newToken = 'fghij-replacement-secret';
      const DAY = 86400000;
      const metadata = { workflow_state: 'active', scopes: ['url:GET|/api/v1/courses'], expires_at: new Date(Date.now() + DAY).toISOString() };
      const replacement = { ...metadata, token: newToken, expires_at: new Date(Date.now() + 30 * DAY).toISOString() };
      const calls = [];
      globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (options.method === 'POST') return Response.json(replacement);
        if (url.endsWith('/courses')) {
          assert.equal(options.headers.Authorization, 'Bearer ' + newToken);
          return Response.json([{ id: 12, name: 'Course' }]);
        }
        return Response.json(metadata);
      };
      ${body}
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home, USERPROFILE: home },
        encoding: "utf8",
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("replacement-secret");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("no token-management calls without explicit consent", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken);
  await rotateTokenIfNeeded();
  assert.equal(calls.length, 0);
  setConfigValue('auto-rotate', 'false');
  await rotateTokenIfNeeded();
  assert.equal(calls.length, 0);
`));

test("consented near-expiry token rotates once, persists, and authenticates the real request path", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, true);
  setConfigValue('auto-rotate', 'true');
  const courses = await makeCanvasRequest('get', 'courses');
  await Promise.all([rotateTokenIfNeeded(), rotateTokenIfNeeded()]);
  assert.equal(courses[0].id, 12);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://school.instructure.com/api/v1/users/self/tokens/abcde');
  const body = JSON.parse(calls[1].options.body);
  assert.deepEqual(body.token.scopes, metadata.scopes);
  assert.ok(Math.abs(Date.parse(body.token.expires_at) - Date.now() - 30 * DAY) < 5000);
  assert.equal(readConfig().token, newToken);
  assert.equal(readConfig().autoRotateToken, true);
  assert.equal(readConfig().tableTruncate, true);
`));

test("parallel consumers share one replacement", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  await Promise.all([rotateTokenIfNeeded(), rotateTokenIfNeeded(), rotateTokenIfNeeded()]);
  assert.equal(calls.filter(c => c.options.method === 'POST').length, 1);
  assert.equal(readConfig().token, newToken);
`));

for (const expiration of [
  "null",
  "new Date(Date.now() + 4 * DAY).toISOString()",
  "new Date(Date.now() - DAY).toISOString()",
  "'invalid'",
]) {
  test(`no replacement for expiration ${expiration}`, () =>
    scenario(`
    metadata.expires_at = ${expiration};
    saveConfig('school.instructure.com', oldToken, false, true);
    await rotateTokenIfNeeded();
    assert.equal(calls.length, 1);
    assert.equal(readConfig().token, oldToken);
  `));
}

test("API denial preserves working credential and consent can be withdrawn", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  globalThis.fetch = async () => new Response('', { status: 403 });
  await rotateTokenIfNeeded();
  assert.equal(readConfig().token, oldToken);
  setConfigValue('auto-rotate', 'false');
  assert.equal(readConfig().autoRotateToken, false);
`));

test("scope broadening and malformed replacement are not saved", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  replacement.scopes = [];
  await rotateTokenIfNeeded();
  assert.equal(readConfig().token, oldToken);
`));

test("credential changes reset consent, unrelated settings preserve it", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  saveConfig('school.instructure.com', oldToken, true);
  assert.equal(readConfig().autoRotateToken, true);
  saveConfig('school.instructure.com', newToken);
  assert.equal(readConfig().autoRotateToken, false);
  saveConfig('school.instructure.com', newToken, false, true);
  saveConfig('other.instructure.com', newToken);
  assert.equal(readConfig().autoRotateToken, false);
`));

test("consent revoked during creation is not overwritten", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') setConfigValue('auto-rotate', 'false');
    return originalFetch(url, options);
  };
  await rotateTokenIfNeeded();
  assert.equal(readConfig().token, oldToken);
  assert.equal(readConfig().autoRotateToken, false);
`));

test("Canvas source visible_token response is accepted", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  replacement.visible_token = replacement.token;
  delete replacement.token;
  await rotateTokenIfNeeded();
  assert.equal(readConfig().token, newToken);
`));

test("atomic save failure leaves the original credential intact", () =>
  scenario(`
  saveConfig('school.instructure.com', oldToken, false, true);
  import fs from 'node:fs';
  const rename = fs.renameSync;
  fs.renameSync = () => { throw new Error('Simulated save failure'); };
  try { await rotateTokenIfNeeded(); } finally { fs.renameSync = rename; }
  assert.equal(readConfig().token, oldToken);
  assert.equal(readConfig().autoRotateToken, true);
  assert.equal(fs.existsSync(getConfigPath() + '.' + process.pid + '.tmp'), false);
`));
