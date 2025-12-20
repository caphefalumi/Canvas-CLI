# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.4] - 2025-12-20

### Changed

- **HTTP Client Migration**: Migrated from axios to native Node.js fetch API
  - Removed axios dependency (v1.13.2)
  - Removed form-data dependency (v4.0.5)
  - Reduced total package count by ~23 packages
  - Uses built-in Node.js 18+ fetch, FormData, and Blob APIs
  - Zero vulnerabilities from HTTP client dependencies
  - Improved error handling with better error messages

### Improved

- **File Upload Error Messages**: Enhanced error messages for assignment submission failures
  - Clearer, more actionable error messages for common upload failures
  - Specific guidance for 403 (permission denied), 401 (unauthorized), and 404 (not found) errors
  - Removed redundant file path repetition in error output
  - Better user experience when troubleshooting upload issues

## [1.7.3] - 2025-12-20

### Added

- **Configuration Set Command**: New `canvas config set <key> <value>` command for granular configuration management
  - Set individual configuration values without interactive prompts
  - Supported keys: `domain`, `token`, `truncate`
  - Automatic validation for each setting type
  - Examples:
    - `canvas config set truncate false` - Disable table truncation
    - `canvas config set domain school.instructure.com` - Update Canvas domain
    - `canvas config set token <your-token>` - Update API token

### Changed

- **Configuration Commands**: Refactored configuration system for better scalability
  - Replaced individual setting commands with unified `set` command
  - More consistent command structure across all configuration operations
  - Easier to extend with new configuration options in the future

## [1.7.2] - 2025-12-20

### Changed

- **Table Display**: Improved text wrapping readability by adding spacing between multi-line rows
  - Rows with wrapped text now have better visual separation
  - Enhanced readability for long course names and descriptions

## [1.7.1] - 2025-12-20

### Added

- **Configurable Table Truncation**: New `tableTruncate` configuration option to control how text is displayed in tables
  - **Wrap mode** (default): Text wraps to multiple lines within column boundaries for full visibility
  - **Truncate mode**: Text is truncated with "..." when it exceeds column width for compact display
  - Configuration accessible via `canvas config setup` and `canvas config edit`
  - Smart word-based wrapping that preserves readability
  - Automatic backward compatibility for existing configurations (defaults to wrap mode)

### Changed

- **List Command**: Removed the "State" column from course listings for cleaner output and more space for course information

### Fixed

- **Version Command Tests**: Version output now properly validates against package.json version
- **Profile Tests**: Fixed import statement to use correct Table class export

## [1.7.0] - 2025-12-17

### Changed (1.7.0)

- **Grades Command**: Refactored to use `Table` class for consistent rendering across all grade displays
  - Simplified overall grades display by showing only final scores/grades when available, or current scores/grades when course is in progress
  - Removed calculated average metric to reduce redundancy with official Canvas grades
  - Improved table responsiveness with flex-based column widths
  - Enhanced status color coding for assignment breakdown

## [1.6.9] - 2025-12-16

### Fixed (1.6.9)

- **CLI Execution on Linux/macOS**: Added missing shebang (`#!/usr/bin/env node`) to fix "import: command not found" errors on Unix-based systems

## [1.6.8] - 2025-12-16

### Added (1.6.8)

- **Todo Command**: New `canvas todo` command to view all pending items across courses
  - Shows assignments and quizzes with due dates, time remaining, and points
  - Color-coded urgency indicators (overdue, due today, upcoming)
  - Sortable by due date with configurable limit (`-l` option)
  - Aliases: `canvas tasks`, `canvas pending`

- **Files Command**: New `canvas files` command to browse and download course files
  - Lists all files in a course with size, type, and last updated date
  - Interactive file download directly from CLI
  - Supports course name argument for quick access
  - Aliases: `canvas file`, `canvas docs`

- **Groups Command**: New `canvas groups` command to view Canvas group memberships
  - Displays course groups and other groups separately
  - Shows member count, role, and join level
  - Option to view group members with `-m` or `--members` flag
  - Aliases: `canvas group`, `canvas teams`

### Changed (1.6.8)

- **Removed Icons**: Cleaned up emoji icons from table displays for cleaner output
  - Icons retained only in interactive file selection menu

## [1.6.7] - 2025-12-15

### Changed (1.6.7)

- **Simplified Setup Documentation**: Removed manual setup instructions from README in favor of the interactive `canvas config setup` command
  - Users now directed to use `canvas config setup` which guides them through the process

## [1.6.6] - 2025-12-15

- **Update Readme**: Add new command and remove redundant parts

## [1.6.5] - 2025-12-15

### Removed (1.6.5)

- **Unused Command File**: Deleted `api.ts` - Raw API command handler that was never imported or used in the CLI
- **Unused Functions from interactive.ts**: `getSubfoldersRecursive()`, `getFilesMatchingWildcard()`, `selectFilesImproved()`
- **Unused Dependencies**: Removed `adm-zip` and `@types/adm-zip` packages

## [1.6.4-fix] - 2025-12-15

### Fix (1.6.4)

- **Remove Postinstall Command**: Change to prepare husky

## [1.6.4] - 2025-12-15

### Added (1.6.4)

- **Modules Command**: New `modules` command to view course modules and their items with progress tracking
- **Calendar Command**: New `calendar` command to view upcoming assignments and events with due dates

### Changed (1.6.4)

- **Course Arguments**: Replaced course ID arguments with course name arguments across all commands (assignments, grades, announcements) for easier usage
- **Workflow Name**: Changed CI workflow name from "CI" to "Test & Build" for better clarity

## [1.6.3] - 2025-12-14

### Added (1.6.3)

- **Live table resize**: Tables re-render automatically when terminal is resized
- **Adaptive truncation**: Text truncation updates dynamically based on terminal width

### Fixed (1.6.3)

- **Submit table truncation**: Reduced excessive truncation in the submit table by compacting columns and shortening date format
- **Table overflow**: Fixed tables overflowing terminal width on small screens
- **Column width calculation**: Corrected border overhead calculation for accurate fitting

### Changed (1.6.3)

- **Submit table columns**: Optimized and tightened column widths for compact display (Assignment Name max width set to 35, Type fixed at 8, Due fixed at 16 with MM/DD/YYYY formatting, Status fixed at 12)

## [1.6.2] - 2025-12-14

- **Table display**: All table now have the same rounded corner format, text size adaptive to the terminal size

## [1.6.1] - 2025-12-13

- **Dry Run Mode**: Submit command now supports `--dry-run` flag to test submission flow without actually uploading files or submitting assignments
- **Assignment URL Display**: After successful submission, the direct link to the assignment is now displayed for easy access

## [1.6.0] - 2025-12-06

### Added (1.6.0)

- **Boxed Table Displays**: All commands now display data in modern boxed tables with rounded corners (╭╮╰╯)
- **Adaptive Column Widths**: Tables dynamically adjust column widths based on terminal size for optimal display
- **Color-Coded Grades**: Assignment grades are now color-coded (green: ≥80%, yellow: ≥50%, red: <50%)
- **Announcements Table**: Course selection and announcements list now displayed in formatted tables
- **Profile Table**: User profile information displayed in clean field/value table format

### Changed (1.6.0)

- **Grades Display**: Merged official grades and calculated statistics into a unified table
- **CLI Descriptions**: Shortened command descriptions for cleaner help output
- **Config Output**: Simplified config help by removing redundant command examples
- **Submit Command**: Updated to use rounded corners and adaptive widths
- **Line Endings**: Standardized all files to LF line endings

### Technical

- Consistent use of box-drawing characters across all commands
- Improved terminal width detection for responsive layouts

## [1.5.1] - 2025-11-05

## [1.4.7] - 2025-11-05

### Added (1.4.7)

- Show allowed file extensions hint in the interactive file browser when an assignment restricts uploads (e.g. `*.pdf`, `*.docx`).
- Add `r` keybinding to the file browser to reload the current directory listing without exiting the browser.

- **Enhanced File Selection UX**: Implemented continuous file selection until empty input
  - Browse current directory with file size display
  - Add multiple files one by one
  - Remove files from selection
  - Show currently selected files
  - Smart file filtering (excludes hidden files, package files)
  - **Wildcard support**: Use patterns like `*.html`, `*.js`, `*.pdf` to select multiple files
  - File type icons for better visual identification

- **Improved Grade Viewing**:
  - Interactive course selection for grade viewing
  - Assignment-level grade details with color coding
  - Overall course grade summary
  - Better grade formatting and status indicators
  - Support for letter grades, excused, and missing assignments

### Notes (1.4.7)

- Bumped package version to 1.4.7.
  - Assignment-level grade details with color coding
  - Overall course grade summary
  - Better grade formatting and status indicators
  - Support for letter grades, excused, and missing assignments

- **Enhanced Display Names**:
  - Show course names instead of IDs in all commands
  - Display assignment names prominently
  - Better labeling of IDs vs names throughout interface

- **Interactive Utilities**:
  - Added validation and retry logic for user input
  - Confirmation helpers with default values
  - List selection utilities with cancel option

### Improved (1.4.7)

- **Submit Command**: Complete redesign with better file selection workflow
- **Grades Command**: Interactive course selection and detailed assignment grades
- **Assignments Command**: Display course names prominently
- **Announcements Command**: Show course names instead of IDs
- **User Experience**: More consistent and intuitive interfaces across all commands

### Fixed (1.4.7)

- Prevent the interactive file browser from permanently removing other stdin listeners: save and restore `process.stdin` 'data' listeners so `readline` and SIGINT (Ctrl+C) continue to work after browser exit.
- Filter file browser listings by `allowed_extensions` when provided by the assignment so disallowed file types cannot be selected (prevents HTTP 400 "filetype not allowed").
- Allow pressing Enter at the final "Proceed with submission? (Y/n)" prompt to accept the default (Yes) to match the shown prompt.
- **Assignment Name Display**: Fixed "Unknown Assignment" issue in submission summary
- **File Selection Flow**: Better error handling and user guidance during file selection
- **Variable Scope**: Proper assignment variable handling throughout submission process

### Technical (1.4.7)

- Enhanced interactive utilities in `lib/interactive.js`
- Better error handling and user guidance
- Improved code organization and modularity

## [1.1.1] - 2025-07-03

### Fixed (1.1.1)

- Removed dotenv dependency that was causing module not found errors
- Fixed configuration file path to use `.canvaslms-cli-config.json`
- Resolved package publishing and global installation issues

### Added (1.1.1)

- Dual binary support: both `canvaslms-cli` and `canvas` commands work

## [1.1.0] - 2025-07-03

### Major Changes (1.1.0)

- Home directory configuration system (~/.canvaslms-cli-config.json)
- Interactive configuration setup wizard (`canvas config setup`)
- Configuration management subcommands:
  - `canvas config show` - Display current configuration
  - `canvas config edit` - Edit existing configuration
  - `canvas config path` - Show config file location
  - `canvas config delete` - Remove configuration file
- Automatic configuration validation for all commands
- Improved error handling and user guidance

### Changed (1.1.0)

- **BREAKING**: Removed environment variable support (.env files)
- Configuration now stored in user's home directory instead of project directory
- Enhanced configuration validation with better error messages
- Improved user onboarding with guided setup process

### Removed (1.1.0)

- dotenv dependency (no longer needed)
- Environment variable fallback support

## [1.0.0] - 2025-07-03

### Added (1.0.0)

- Initial release of Canvas CLI Tool
- Modular architecture with separate command handlers
- Interactive assignment submission with file upload
- Course management (list starred/all courses)
- Assignment operations (view, filter by status)
- Grade viewing for all courses or specific course
- Announcements viewing
- User profile management
- Raw API access for all HTTP methods (GET, POST, PUT, DELETE)
- Comprehensive configuration management
- Color-coded output for better readability
- Support for multiple file uploads
- File selection from current directory
- Detailed verbose modes for all commands

### Features (1.0.0)

- 📚 Course listing with favorites support
- 📝 Assignment management with status indicators
- 🚀 Interactive file submission workflow
- 📢 Announcement viewing
- 👤 Profile information display
- 🔧 Direct Canvas API access
- ⚡ Command aliases for faster usage
- 🎨 Color-coded grade display
- 📁 Smart file selection interface

### Technical (1.0.0)

- Modular command structure in separate files
- Reusable API client library
- Interactive prompt utilities
- File upload handling with progress indicators
- Error handling and user-friendly messages
- Cross-platform compatibility

### Planned Features

- Assignment creation and editing
- Bulk operations
- Plugin system
- Advanced filtering options
- Export functionality
- Offline mode support
