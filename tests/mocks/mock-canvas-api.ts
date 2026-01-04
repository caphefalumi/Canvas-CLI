/**
 * Mock Canvas API Request Handler
 * Provides a comprehensive mock system for testing Canvas CLI commands
 */

import {
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
  fixtures,
} from "./fixtures.js";

export interface MockResponse<T = any> {
  data: T;
  status?: number;
  headers?: Record<string, string>;
}

export interface MockRequestConfig {
  method: string;
  endpoint: string;
  queryParams?: string[];
  body?: any;
}

export interface MockError {
  status: number;
  message: string;
  errors?: { message: string }[];
}

function isMockError(
  response: MockResponse | MockError,
): response is MockError {
  return "message" in response && typeof response.message === "string";
}

type MockHandler = (config: MockRequestConfig) => MockResponse | MockError;

// Registry of custom mock handlers
const customHandlers = new Map<string, MockHandler>();

// Registry of one-time responses
const oneTimeResponses = new Map<string, MockResponse | MockError>();

// Error simulation configuration
let simulateError: MockError | null = null;
let simulateNetworkError = false;
let requestDelay = 0;

// Request history for assertions
const requestHistory: MockRequestConfig[] = [];

/**
 * Parse query parameters from string array to object
 */
function parseQueryParams(params: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const param of params) {
    const [key, value] = param.split("=", 2);
    if (key) {
      result[key] = value ?? "";
    }
  }
  return result;
}

/**
 * Extract course ID from endpoint
 */
function extractCourseId(endpoint: string): number | null {
  const match = endpoint.match(/courses\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract assignment ID from endpoint
 */
function extractAssignmentId(endpoint: string): number | null {
  const match = endpoint.match(/assignments\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract module ID from endpoint
 */
function extractModuleId(endpoint: string): number | null {
  const match = endpoint.match(/modules\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Default endpoint handlers that simulate Canvas API behavior
 */
const defaultHandlers: Record<string, MockHandler> = {
  // Courses
  "GET:courses": (config) => {
    const params = parseQueryParams(config.queryParams || []);
    let courses = [...mockCourses];

    // Filter by enrollment state
    if (params.enrollment_state === "active") {
      courses = courses.filter((c) => c.workflow_state === "available");
    }

    return { data: courses };
  },

  "GET:courses/:id": (config) => {
    const courseId = extractCourseId(config.endpoint);
    const course = mockCourses.find((c) => c.id === courseId);
    if (!course) {
      return { status: 404, message: "Course not found" };
    }
    return { data: course };
  },

  // Assignments
  "GET:courses/:id/assignments": (config) => {
    const courseId = extractCourseId(config.endpoint);
    const params = parseQueryParams(config.queryParams || []);
    let assignments = mockAssignments.filter((a) => a.course_id === courseId);

    // Include submission if requested
    if (params["include[]"] === "submission") {
      assignments = assignments.map((a) => ({
        ...a,
        submission:
          mockSubmissions.find((s) => s.assignment_id === a.id) || null,
      }));
    }

    return { data: assignments };
  },

  "GET:courses/:id/assignments/:assignmentId": (config) => {
    const assignmentId = extractAssignmentId(config.endpoint);
    const assignment = mockAssignments.find((a) => a.id === assignmentId);
    if (!assignment) {
      return { status: 404, message: "Assignment not found" };
    }
    return { data: assignment };
  },

  // User Profile
  "GET:users/self": () => {
    return { data: mockUser };
  },

  "GET:users/self/profile": () => {
    return { data: mockUser };
  },

  // Announcements
  "GET:announcements": (config) => {
    const params = parseQueryParams(config.queryParams || []);
    let announcements = [...mockAnnouncements];

    // Filter by context codes
    if (params["context_codes[]"]) {
      const contextCode = params["context_codes[]"];
      announcements = announcements.filter(
        (a) => a.context_code === contextCode,
      );
    }

    // Limit results
    const limit = params.per_page ? parseInt(params.per_page, 10) : 10;
    announcements = announcements.slice(0, limit);

    return { data: announcements };
  },

  // Discussion Topics (used for announcements)
  "GET:courses/:id/discussion_topics": (config) => {
    const courseId = extractCourseId(config.endpoint);
    const params = parseQueryParams(config.queryParams || []);
    let announcements = mockAnnouncements.filter(
      (a) => a.context_code === `course_${courseId}`,
    );

    // Filter by only_announcements
    if (params.only_announcements === "true") {
      // All mock announcements are announcements
    }

    // Limit results
    const limit = params.per_page ? parseInt(params.per_page, 10) : 10;
    announcements = announcements.slice(0, limit);

    return { data: announcements };
  },

  // Modules
  "GET:courses/:id/modules": (_config) => {
    const modules = mockModules.filter((m) =>
      mockModuleItems.some((item) => item.module_id === m.id),
    );
    return { data: modules };
  },

  "GET:courses/:id/modules/:moduleId/items": (config) => {
    const moduleId = extractModuleId(config.endpoint);
    const items = mockModuleItems.filter((item) => item.module_id === moduleId);
    return { data: items };
  },

  // Todo Items
  "GET:users/self/todo": (config) => {
    const params = parseQueryParams(config.queryParams || []);
    let todos = [...mockTodoItems];

    const limit = params.per_page ? parseInt(params.per_page, 10) : 10;
    todos = todos.slice(0, limit);

    return { data: todos };
  },

  // Files
  "GET:courses/:id/files": (_config) => {
    return { data: mockFiles };
  },

  "GET:courses/:id/folders": () => {
    return { data: mockFolders };
  },

  "GET:folders/:id/files": () => {
    return { data: mockFiles };
  },

  // Groups
  "GET:users/self/groups": () => {
    return { data: mockGroups };
  },

  "GET:groups/:id/users": () => {
    return { data: [mockUser] };
  },

  // Enrollments
  "GET:courses/:id/enrollments": (config) => {
    const courseId = extractCourseId(config.endpoint);
    const enrollments = mockEnrollments.filter((e) => e.course_id === courseId);
    return { data: enrollments };
  },

  "GET:users/self/enrollments": () => {
    return { data: mockEnrollments };
  },

  // Calendar Events
  "GET:calendar_events": (config) => {
    const params = parseQueryParams(config.queryParams || []);
    let events = [...mockCalendarEvents];

    // Filter by date range if provided
    if (params.start_date) {
      const startDate = new Date(params.start_date);
      events = events.filter((e) => new Date(e.start_at) >= startDate);
    }

    if (params.end_date) {
      const endDate = new Date(params.end_date);
      events = events.filter((e) => new Date(e.start_at) <= endDate);
    }

    return { data: events };
  },

  // Submissions
  "GET:courses/:id/assignments/:assignmentId/submissions/self": (config) => {
    const assignmentId = extractAssignmentId(config.endpoint);
    const submission = mockSubmissions.find(
      (s) => s.assignment_id === assignmentId,
    );
    if (!submission) {
      return { data: { workflow_state: "unsubmitted" } };
    }
    return { data: submission };
  },

  "POST:courses/:id/assignments/:assignmentId/submissions": (config) => {
    const assignmentId = extractAssignmentId(config.endpoint);
    return {
      data: {
        id: Date.now(),
        assignment_id: assignmentId,
        user_id: mockUser.id,
        submission_type: "online_upload",
        submitted_at: new Date().toISOString(),
        score: null,
        grade: null,
        attempt: 1,
        workflow_state: "submitted",
        late: false,
        missing: false,
      },
    };
  },

  // File Upload
  "POST:courses/:id/assignments/:assignmentId/submissions/self/files": () => {
    return {
      data: {
        upload_url: "https://canvas.example.com/files/upload",
        upload_params: {
          key: "uploads/12345/file.pdf",
          filename: "file.pdf",
          content_type: "application/pdf",
        },
        file_param: "file",
      },
    };
  },
};

/**
 * Match endpoint to handler pattern
 */
function matchEndpoint(method: string, endpoint: string): MockHandler | null {
  // Normalize endpoint
  const normalizedEndpoint = endpoint.replace(/^\//, "").replace(/\/$/, "");

  // Check custom handlers first
  for (const [pattern, handler] of customHandlers) {
    if (matchPattern(`${method}:${normalizedEndpoint}`, pattern)) {
      return handler;
    }
  }

  // Check default handlers
  for (const [pattern, handler] of Object.entries(defaultHandlers)) {
    if (matchPattern(`${method}:${normalizedEndpoint}`, pattern)) {
      return handler;
    }
  }

  return null;
}

/**
 * Match URL pattern with :param placeholders
 */
function matchPattern(actual: string, pattern: string): boolean {
  // Convert pattern to regex
  // Escape special regex characters first
  let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // Then replace :param patterns (when preceded by /)
  regexStr = regexStr.replace(/\/:([^/]+)/g, "/[^/]+");
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(actual);
}

/**
 * Main mock request function
 */
export async function mockMakeCanvasRequest<T = any>(
  method: string,
  endpoint: string,
  queryParams: string[] = [],
  requestBody: string | null = null,
): Promise<T> {
  const config: MockRequestConfig = {
    method: method.toUpperCase(),
    endpoint: endpoint.replace(/^\//, ""),
    queryParams,
    body: requestBody ? JSON.parse(requestBody) : null,
  };

  // Record request for assertions
  requestHistory.push(config);

  // Simulate delay if configured
  if (requestDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, requestDelay));
  }

  // Simulate network error
  if (simulateNetworkError) {
    throw new Error("Network error: Unable to reach Canvas API");
  }

  // Simulate configured error
  if (simulateError) {
    const error = simulateError;
    throw new Error(`HTTP ${error.status}: ${error.message}`);
  }

  // Check for one-time response
  const oneTimeKey = `${config.method}:${config.endpoint}`;
  if (oneTimeResponses.has(oneTimeKey)) {
    const response = oneTimeResponses.get(oneTimeKey)!;
    oneTimeResponses.delete(oneTimeKey);

    if (isMockError(response) && response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.message}`);
    }
    if (!isMockError(response)) {
      return response.data as T;
    }
  }

  // Find and execute handler
  const handler = matchEndpoint(config.method, config.endpoint);

  if (!handler) {
    // Return empty array/object for unknown endpoints
    console.warn(
      `[MockAPI] No handler for ${config.method} ${config.endpoint}`,
    );
    return [] as unknown as T;
  }

  const result = handler(config);

  // Check if result is an error
  if (isMockError(result) && result.status >= 400) {
    throw new Error(`HTTP ${result.status}: ${result.message}`);
  }

  if (!isMockError(result)) {
    return result.data as T;
  }

  return [] as unknown as T;
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Register a custom handler for a specific endpoint pattern
 */
export function registerMockHandler(
  pattern: string,
  handler: MockHandler,
): void {
  customHandlers.set(pattern, handler);
}

/**
 * Remove a custom handler
 */
export function unregisterMockHandler(pattern: string): void {
  customHandlers.delete(pattern);
}

/**
 * Set a one-time response for a specific request
 */
export function setMockResponse<T>(
  method: string,
  endpoint: string,
  response: T,
  status = 200,
): void {
  oneTimeResponses.set(`${method.toUpperCase()}:${endpoint}`, {
    data: response,
    status,
  });
}

/**
 * Set a one-time error response
 */
export function setMockError(
  method: string,
  endpoint: string,
  status: number,
  message: string,
): void {
  oneTimeResponses.set(`${method.toUpperCase()}:${endpoint}`, {
    status,
    message,
    data: null,
  });
}

/**
 * Configure error simulation for all requests
 */
export function simulateApiError(status: number, message: string): void {
  simulateError = { status, message };
}

/**
 * Configure network error simulation
 */
export function simulateNetworkFailure(enable = true): void {
  simulateNetworkError = enable;
}

/**
 * Configure request delay (for testing loading states)
 */
export function setRequestDelay(ms: number): void {
  requestDelay = ms;
}

/**
 * Get request history for assertions
 */
export function getRequestHistory(): MockRequestConfig[] {
  return [...requestHistory];
}

/**
 * Get the last request made
 */
export function getLastRequest(): MockRequestConfig | undefined {
  return requestHistory[requestHistory.length - 1];
}

/**
 * Clear request history
 */
export function clearRequestHistory(): void {
  requestHistory.length = 0;
}

/**
 * Reset all mock configurations to default state
 */
export function resetMocks(): void {
  customHandlers.clear();
  oneTimeResponses.clear();
  simulateError = null;
  simulateNetworkError = false;
  requestDelay = 0;
  requestHistory.length = 0;
}

/**
 * Assert that a specific request was made
 */
export function assertRequestMade(
  method: string,
  endpointPattern: string,
): boolean {
  return requestHistory.some(
    (req) =>
      req.method === method.toUpperCase() &&
      matchPattern(
        `${req.method}:${req.endpoint}`,
        `${method.toUpperCase()}:${endpointPattern}`,
      ),
  );
}

/**
 * Count requests matching a pattern
 */
export function countRequests(method: string, endpointPattern: string): number {
  return requestHistory.filter(
    (req) =>
      req.method === method.toUpperCase() &&
      matchPattern(
        `${req.method}:${req.endpoint}`,
        `${method.toUpperCase()}:${endpointPattern}`,
      ),
  ).length;
}

// Re-export fixtures for convenience
export { fixtures } from "./fixtures.js";
