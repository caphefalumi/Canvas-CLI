/**
 * Canvas API client
 */

import fs from "fs";
import { getInstanceConfig } from "./config.js";
import { printError, printSuccess } from "./display.js";
import type { CanvasCourse } from "../types/index.js";

export async function getCanvasCourse(
  courseName: string,
): Promise<CanvasCourse | undefined> {
  const courses = await getCanvasCourses(true);

  // Find the best matching course using a scoring algorithm
  const searchTerm = courseName.toLowerCase();
  const coursesWithScores = courses
    .map((course) => {
      const name = course.name.toLowerCase();
      let score = 0;

      // Exact match gets highest score
      if (name === searchTerm) {
        score = 1000;
      }
      // Name starts with search term
      else if (name.startsWith(searchTerm)) {
        score = 500;
      }
      // Name contains search term
      else if (name.includes(searchTerm)) {
        score = 100;
        // Bonus points for how early the match appears
        score += 100 - name.indexOf(searchTerm);
      }

      // Bonus for shorter names (more specific match)
      if (score > 0) {
        score += 100 - Math.min(name.length, 100);
      }

      return { course, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const selectedCourse = coursesWithScores[0]?.course;

  if (!selectedCourse) {
    printError(`Course "${courseName}" not found.`);
    return;
  }
  printSuccess(`Using course: ${selectedCourse.name}`);

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
