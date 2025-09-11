/**
 * File upload utilities for Canvas
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { makeCanvasRequest } from './api-client.js';

/**
 * Upload single file to Canvas and return the file ID
 */
export async function uploadSingleFileToCanvas(courseId, assignmentId, filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    // Step 1: Get upload URL from Canvas
    const uploadParams = [
      `name=${encodeURIComponent(fileName)}`,
      `size=${fileContent.length}`,
      'parent_folder_path=/assignments'
    ];
    
    const uploadData = await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions/self/files`, uploadParams);
    
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
    return uploadData.id || uploadResponse.data.id;
    
  } catch (error) {
    throw new Error(`Failed to upload file ${filePath}: ${error.message}`);
  }
}

/**
 * Submit assignment with uploaded files
 */
export async function submitAssignmentWithFiles(courseId, assignmentId, fileIds) {
  const submissionData = {
    submission: {
      submission_type: 'online_upload',
      file_ids: fileIds
    }
  };

  return await makeCanvasRequest('post', `courses/${courseId}/assignments/${assignmentId}/submissions`, [], JSON.stringify(submissionData));
}
