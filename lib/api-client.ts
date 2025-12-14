/**
 * Canvas API client
 */

import axios, { AxiosRequestConfig } from "axios";
import fs from "fs";
import { getInstanceConfig } from "./config.js";
import type { CanvasCourse } from "../types/index.js";

export async function getCanvasCourse(
  courseName: string,
): Promise<CanvasCourse | undefined> {
  const courses = await getCanvasCourses(true);
  return courses.find((c) =>
    c.name.toLowerCase().includes(courseName.toLowerCase()),
  );
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
  const url = `${baseUrl}/${endpoint.replace(/^\//, "")}`;

  // Setup request configuration
  const config: AxiosRequestConfig = {
    method: method.toLowerCase(),
    url: url,
    headers: {
      Authorization: `Bearer ${instanceConfig.token}`,
      "Content-Type": "application/json",
    },
  };

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
    config.params = params;
  }

  // Add request body for POST/PUT requests
  if (
    requestBody &&
    (method.toLowerCase() === "post" || method.toLowerCase() === "put")
  ) {
    if (requestBody.startsWith("@")) {
      // Read from file
      const filename = requestBody.substring(1);
      try {
        config.data = JSON.parse(fs.readFileSync(filename, "utf8"));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error reading file ${filename}: ${errorMessage}`);
        process.exit(1);
      }
    } else {
      // Parse JSON string
      try {
        config.data = JSON.parse(requestBody);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON: ${errorMessage}`);
        process.exit(1);
      }
    }
  }

  try {
    const response = await axios<T>(config);

    // Filter ORG- courses for Swinburne
    if (
      instanceConfig.domain === "swinburne.instructure.com" &&
      endpoint === "courses" &&
      Array.isArray(response.data)
    ) {
      const data = response.data as any[];
      const filteredData = data.filter(
        (item: any) => !item.name || !item.name.startsWith("ORG-"),
      );
      return filteredData as unknown as T;
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(
        `HTTP ${error.response.status}: ${error.response.statusText}`,
      );
      if (error.response.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Request failed: ${errorMessage}`);
    }
    process.exit(1);
  }
}
