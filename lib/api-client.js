/**
 * Canvas API client
 */

const axios = require('axios');
const fs = require('fs');
const { getInstanceConfig } = require('./config');

/**
 * Make Canvas API request
 */
async function makeCanvasRequest(method, endpoint, queryParams = [], requestBody = null) {
  const instanceConfig = getInstanceConfig();
  
  // Construct the full URL
  const baseUrl = `https://${instanceConfig.domain}/api/v1`;
  const url = `${baseUrl}/${endpoint.replace(/^\//, '')}`;
  
  // Setup request configuration
  const config = {
    method: method.toLowerCase(),
    url: url,
    headers: {
      'Authorization': `Bearer ${instanceConfig.token}`,
      'Content-Type': 'application/json'
    }
  };
  
  // Add query parameters
  if (queryParams.length > 0) {
    const params = new URLSearchParams();
    queryParams.forEach(param => {
      const [key, value] = param.split('=', 2);
      params.append(key, value || '');
    });
    config.params = params;
  }
  
  // Add request body for POST/PUT requests
  if (requestBody && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
    if (requestBody.startsWith('@')) {
      // Read from file
      const filename = requestBody.substring(1);
      try {
        config.data = JSON.parse(fs.readFileSync(filename, 'utf8'));
      } catch (error) {
        console.error(`Error reading file ${filename}: ${error.message}`);
        process.exit(1);
      }
    } else {
      // Parse JSON string
      try {
        config.data = JSON.parse(requestBody);
      } catch (error) {
        console.error(`Error parsing JSON: ${error.message}`);
        process.exit(1);
      }
    }
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error(`Request failed: ${error.message}`);
    }
    process.exit(1);
  }
}

module.exports = {
  makeCanvasRequest
};
