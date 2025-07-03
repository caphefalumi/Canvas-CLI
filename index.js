/**
 * Canvas CLI Tool - Main export module
 * 
 * This module exports the core functionality of the Canvas CLI tool
 * for programmatic use by other Node.js applications.
 */

// Core libraries
const { makeCanvasRequest } = require('./lib/api-client');
const { loadConfig, getInstanceConfig } = require('./lib/config');
const { createReadlineInterface, askQuestion } = require('./lib/interactive');
const { uploadSingleFileToCanvas, submitAssignmentWithFiles } = require('./lib/file-upload');

// Command handlers
const { listCourses } = require('./commands/list');
const { showConfig } = require('./commands/config');
const { listAssignments } = require('./commands/assignments');
const { showGrades } = require('./commands/grades');
const { showAnnouncements } = require('./commands/announcements');
const { showProfile } = require('./commands/profile');
const { submitAssignment } = require('./commands/submit');
const { createQueryHandler } = require('./commands/api');

module.exports = {
  // Core API
  api: {
    makeCanvasRequest,
    loadConfig,
    getInstanceConfig
  },
  
  // Utilities
  utils: {
    interactive: {
      createReadlineInterface,
      askQuestion
    },
    fileUpload: {
      uploadSingleFileToCanvas,
      submitAssignmentWithFiles
    }
  },
  
  // Commands
  commands: {
    listCourses,
    showConfig,
    listAssignments,
    showGrades,
    showAnnouncements,
    showProfile,
    submitAssignment,
    createQueryHandler
  }
};
