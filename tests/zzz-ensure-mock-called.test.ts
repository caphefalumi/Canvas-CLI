import { getMockCanvasRequestCallCount } from "../lib/api-client.js";
import { test, expect } from "bun:test";
// This test asserts that during the test run at least one test injected the mock
// request implementation by calling `setMockCanvasRequest`. The test filename is
// prefixed with `zzz-` to increase the chance it runs last so the counter will
// reflect previous tests. This is a lightweight CI check to detect tests that
// forgot to wire the mock when making network calls.

test("mock request function was set at least once during tests", () => {
  const count = getMockCanvasRequestCallCount();

  expect(count).toBeGreaterThan(0);
});
