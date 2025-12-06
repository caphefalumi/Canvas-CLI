/**
 * File upload utilities for Canvas
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { makeCanvasRequest } from './api-client.js';
import type { FileUploadResponse } from '../types/index.js';

/**
 * Upload single file to Canvas and return the file ID
 */
export async function uploadSingleFileToCanvas(
  courseId: number,
  assignmentId: number,
  filePath: string
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
      'parent_folder_path=/assignments'
    ];
    
    const uploadData = await makeCanvasRequest<FileUploadResponse>(
      'post',
      `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`,
      uploadParams
    );
    
    if (!uploadData.upload_url) {
      throw new Error('Failed to get upload URL from Canvas');
    }

    // Step 2: Upload file to the provided URL
    const form = new FormData();
    
    // Add all the required fields from Canvas response
    Object.keys(uploadData.upload_params).forEach(key => {
      form.append(key, uploadData.upload_params[key]);
    });
    
    // Add the file
    form.append('file', fileContent, fileName);

    const uploadResponse = await axios.post(uploadData.upload_url, form, {
      headers: form.getHeaders(),
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    // Return the file ID for later submission
    const fileId = (uploadData as any).id || uploadResponse.data.id;
    if (typeof fileId !== 'number') {
      throw new Error('Failed to get file ID from upload response');
    }
    return fileId;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Submit assignment with uploaded files
 */
export async function submitAssignmentWithFiles(
  courseId: number,
  assignmentId: number,
  fileIds: number[]
): Promise<any> {
  const submissionData = {
    submission: {
      submission_type: 'online_upload',
      file_ids: fileIds
    }
  };

  return await makeCanvasRequest(
    'post',
    `courses/${courseId}/assignments/${assignmentId}/submissions`,
    [],
    JSON.stringify(submissionData)
  );
}
