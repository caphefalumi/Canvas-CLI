/**
 * Canvas CLI Test Mocks
 * Export all mock utilities and fixtures for testing
 */

// Mock API
export {
  mockMakeCanvasRequest,
  registerMockHandler,
  unregisterMockHandler,
  setMockResponse,
  setMockError,
  simulateApiError,
  simulateNetworkFailure,
  setRequestDelay,
  getRequestHistory,
  getLastRequest,
  clearRequestHistory,
  resetMocks,
  assertRequestMade,
  countRequests,
  type MockResponse,
  type MockRequestConfig,
  type MockError,
} from "./mock-canvas-api.js";

// Fixtures
export {
  mockCourses,
  mockAssignments,
  mockSubmissions,
  mockUser,
  mockAnnouncements,
  mockModules,
  mockModuleItems,
  mockTodoItems,
  mockFiles,
  mockFolders,
  mockGroups,
  mockEnrollments,
  mockCalendarEvents,
  mockAssignmentsWithSubmissions,
  fixtures,
  type CanvasCalendarEvent,
} from "./fixtures.js";

// Test helpers
import {
  resetMocks,
  clearRequestHistory,
  mockMakeCanvasRequest,
} from "./mock-canvas-api.js";
import { setMockCanvasRequest } from "../../lib/api-client.js";

/**
 * Setup test environment for Canvas API mocking
 * Call this in beforeEach to ensure clean state
 */
export function setupMockEnvironment(): void {
  process.env.NODE_ENV = "testing";
  setMockCanvasRequest(mockMakeCanvasRequest);
  resetMocks();
}

/**
 * Teardown test environment
 * Call this in afterEach to clean up
 */
export function teardownMockEnvironment(): void {
  resetMocks();
  setMockCanvasRequest(null);
  delete process.env.NODE_ENV;
}

/**
 * Create a test context with automatic setup/teardown
 */
export function createTestContext() {
  return {
    setup: setupMockEnvironment,
    teardown: teardownMockEnvironment,
    reset: resetMocks,
    clearHistory: clearRequestHistory,
  };
}

// Re-export setMockCanvasRequest for direct access
export { setMockCanvasRequest } from "../../lib/api-client.js";
