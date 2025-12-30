import {
  setupMockEnvironment,
  teardownMockEnvironment,
  getLastRequest,
  assertRequestMade,
} from "./mocks/index.js";
import { getCanvasCourses } from "../lib/api-client.js";
import {
  describe,
  beforeEach,
  afterAll,
  afterEach,
  test,
  expect,
} from "bun:test";

describe("API client uses mock in tests", () => {
  beforeEach(() => {
    setupMockEnvironment(); // sets NODE_ENV and calls setMockCanvasRequest(mockMakeCanvasRequest)
  });

  afterEach(() => {
    teardownMockEnvironment();
  });

  test("getCanvasCourses delegates to the mock", async () => {
    const result = await getCanvasCourses(true); // triggers makeCanvasRequest internally

    // Basic sanity: mock returns an array
    expect(Array.isArray(result)).toBe(true);

    // Inspect the last request the mock received
    const last = getLastRequest();
    expect(last).toBeDefined();
    expect(last?.method).toBe("GET");
    // endpoint stored without leading slash in the mock, so check 'courses'
    expect(last?.endpoint).toBe("courses");

    // Or use helper to assert pattern matches
    expect(assertRequestMade("GET", "courses")).toBe(true);
  });
});
