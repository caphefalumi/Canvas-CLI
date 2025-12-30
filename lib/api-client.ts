/**
 * Canvas API client
 */
void import("dotenv")
  .then((mod) => {
    try {
      if (mod && typeof mod.config === "function") {
        mod.config();
      }
    } catch {}
  })
  .catch(() => {});

import fs from "fs";
import { getInstanceConfig } from "./config.js";
import { printError, printSuccess, printWarning } from "./display.js";
import type { CanvasCourse } from "../types/index.js";
import chalk from "chalk";
import { askQuestion } from "../index.js";
import readline from "readline";

// Allow tests to inject a mock request implementation. Tests call `setMockCanvasRequest`
// to replace network calls with `mockMakeCanvasRequest` from the test mocks.
type CanvasRequestFn = <T = any>(
  method: string,
  endpoint: string,
  queryParams?: string[],
  requestBody?: string | null,
) => Promise<T>;

let _mockCanvasRequest: CanvasRequestFn | null = null;

let _mockCanvasRequestCallCount = 0;

export function setMockCanvasRequest(fn: CanvasRequestFn | null): void {
  _mockCanvasRequest = fn;
  if (fn) {
    _mockCanvasRequestCallCount += 1;
  }
}

// Test helper: return how many times a mock request function was set.
export function getMockCanvasRequestCallCount(): number {
  return _mockCanvasRequestCallCount;
}

/**
 * Get a specific course by name, prompting user if multiple matches found
 */
export async function getCanvasCourse(
  courseName: string,
  rl: readline.Interface,
  options: { onlyStarred?: boolean; successMessage?: string } = {},
): Promise<CanvasCourse | undefined> {
  const courses = await getCanvasCourses(true);

  // Find the best matching course using a scoring algorithm
  const searchTerm = courseName.toLowerCase();
  let selectedCourse: CanvasCourse | undefined;
  let matches = courses.filter((course) =>
    course.name.toLowerCase().includes(searchTerm),
  );

  // Filter to only starred courses if requested
  if (options.onlyStarred) {
    matches = matches.filter((course) => course.is_favorite);
  }

  if (matches.length === 0) {
    const filterMsg = options.onlyStarred ? " (starred)" : "";
    printError(`No courses${filterMsg} found matching "${courseName}".`);
    return;
  } else if (matches.length === 1) {
    selectedCourse = matches[0];
  } else {
    printWarning(
      `\nFound ${matches.length} courses matching "${courseName}":\n`,
    );
    matches.forEach((course, index) => {
      const star = course.is_favorite ? chalk.yellow("★") : " ";
      console.log(
        `${index + 1}. ${star} ${course.name} (${course.course_code})`,
      );
    });

    const choice = await askQuestion(rl, "\nEnter course number to select: ");
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < matches.length) {
      selectedCourse = matches[index];
    } else {
      console.log(chalk.red("Invalid selection."));
      return;
    }
  }
  if (!selectedCourse) {
    printError(`No courses found matching "${courseName}".`);
    return;
  }
  if (options.successMessage) {
    console.log(options.successMessage);
  } else {
    printSuccess(`Using course: ${selectedCourse.name}`);
  }

  return selectedCourse;
}

export async function getCanvasCourses(
  getAllCourse: boolean,
): Promise<CanvasCourse[]> {
  const queryParams = [
    "enrollment_state=active",
    "per_page=100",
    "include[]=term",
    "include[]=favorites",
  ];

  const courses = await makeCanvasRequest<CanvasCourse[]>(
    "get",
    "courses",
    queryParams,
  );

  return getAllCourse ? courses : courses.filter((c) => c.is_favorite);
}

/**
 * Make Canvas API request
 */
export async function makeCanvasRequest<T = any>(
  method: string,
  endpoint: string,
  queryParams: string[] = [],
  requestBody: string | null = null,
): Promise<T> {
  // If a mock request function has been injected (tests), delegate to it.
  if (_mockCanvasRequest) {
    return _mockCanvasRequest<T>(method, endpoint, queryParams, requestBody);
  }
  const instanceConfig = getInstanceConfig();
  // Construct the full URL
  const baseUrl = `https://${instanceConfig.domain}/api/v1`;
  let url = `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  // Add query parameters
  if (queryParams.length > 0) {
    const params = new URLSearchParams();
    queryParams.forEach((param) => {
      const parts = param.split("=", 2);
      const key = parts[0];
      const value = parts[1] ?? "";
      if (key) {
        params.append(key, value);
      }
    });
    url += `?${params.toString()}`;
  }

  // Setup request configuration
  const headers: Record<string, string> = {
    Authorization: `Bearer ${instanceConfig.token}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method: method.toUpperCase(),
    headers,
  };

  // Add request body for POST/PUT requests
  if (
    requestBody &&
    (method.toLowerCase() === "post" || method.toLowerCase() === "put")
  ) {
    if (requestBody.startsWith("@")) {
      // Read from file
      const filename = requestBody.substring(1);
      try {
        const fileData = JSON.parse(fs.readFileSync(filename, "utf8"));
        options.body = JSON.stringify(fileData);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error reading file ${filename}: ${errorMessage}`);
        process.exit(1);
      }
    } else {
      try {
        const data = JSON.parse(requestBody);
        options.body = JSON.stringify(data);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON: ${errorMessage}`);
        process.exit(1);
      }
    }
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;

      if (status === 403) {
        throw new Error(
          "Access denied. You don't have permission to access this resource.",
        );
      }
      if (status === 401) {
        throw new Error(
          "Unauthorized. Please check your API token with 'canvas config setup'.",
        );
      }
      if (status === 404) {
        throw new Error(
          "Resource not found. The requested item may have been deleted or moved.",
        );
      }

      try {
        const errorData = (await response.json()) as any;
        const message = errorData?.errors?.[0]?.message || statusText;
        throw new Error(`HTTP ${status}: ${message}`);
      } catch {
        throw new Error(`HTTP ${status}: ${statusText}`);
      }
    }

    const data = (await response.json()) as T;

    // Filter ORG- courses for Swinburne
    if (
      instanceConfig.domain === "swinburne.instructure.com" &&
      endpoint === "courses" &&
      Array.isArray(data)
    ) {
      const filteredData = data.filter(
        (item: any) => !item.name || !item.name.startsWith("ORG-"),
      );
      return filteredData as unknown as T;
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("HTTP")) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Request failed: ${errorMessage}`);
  }
}
