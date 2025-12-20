/**
 * File upload utilities for Canvas
 */

import fs from "fs";
import path from "path";
import { makeCanvasRequest } from "./api-client.js";
import type { FileUploadResponse } from "../types/index.js";

/**
 * Upload single file to Canvas and return the file ID
 */
export async function uploadSingleFileToCanvas(
  courseId: number,
  assignmentId: number,
  filePath: string,
): Promise<number> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    // Step 1: Get upload URL from Canvas
    const uploadParams = [
      `name=${fileName}`,
      `size=${fileContent.length}`,
      "parent_folder_path=/assignments",
    ];

    const uploadData = await makeCanvasRequest<FileUploadResponse>(
      "post",
      `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
      uploadParams,
    );

    if (!uploadData.upload_url) {
      throw new Error("Failed to get upload URL from Canvas");
    }

    // Step 2: Upload file to the provided URL
    const form = new FormData();

    // Add all the required fields from Canvas response
    Object.keys(uploadData.upload_params).forEach((key) => {
      form.append(key, uploadData.upload_params[key]);
    });

    // Add the file as a Blob
    const fileBlob = new Blob([fileContent], {
      type: "application/octet-stream",
    });
    form.append("file", fileBlob, fileName);

    const uploadResponse = await fetch(uploadData.upload_url, {
      method: "POST",
      body: form,
      redirect: "manual", // Don't follow redirects
    });

    if (
      !uploadResponse.ok &&
      uploadResponse.status !== 301 &&
      uploadResponse.status !== 302
    ) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    // Return the file ID for later submission
    let fileId: number;
    if ((uploadData as any).id) {
      fileId = (uploadData as any).id;
    } else {
      const responseData = (await uploadResponse.json()) as any;
      fileId = responseData.id;
    }

    if (typeof fileId !== "number") {
      throw new Error("Failed to get file ID from upload response");
    }
    return fileId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more helpful error messages
    if (
      errorMessage.includes("Access denied") ||
      errorMessage.includes("403")
    ) {
      throw new Error(
        `Upload failed - Permission denied. This assignment may not accept submissions, may be locked, or the due date has passed. Check the assignment settings in Canvas.`,
      );
    }

    if (errorMessage.includes("Unauthorized") || errorMessage.includes("401")) {
      throw new Error(
        `Upload failed - Authentication error. Your API token may have expired. Run 'canvas config setup' to update it.`,
      );
    }

    if (errorMessage.includes("404")) {
      throw new Error(
        `Upload failed - Assignment or course not found. The assignment may have been deleted or moved.`,
      );
    }

    if (errorMessage.includes("File not found")) {
      throw new Error(`File not found: ${filePath}`);
    }

    // For other errors, provide context
    throw new Error(`Upload failed: ${errorMessage}`);
  }
}

/**
 * Submit assignment with uploaded files
 */
export async function submitAssignmentWithFiles(
  courseId: number,
  assignmentId: number,
  fileIds: number[],
): Promise<any> {
  const submissionData = {
    submission: {
      submission_type: "online_upload",
      file_ids: fileIds,
    },
  };

  return await makeCanvasRequest(
    "post",
    `courses/${courseId}/assignments/${assignmentId}/submissions`,
    [],
    JSON.stringify(submissionData),
  );
}
