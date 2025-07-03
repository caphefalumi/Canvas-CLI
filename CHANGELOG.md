# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-07-03

### Fixed

- Removed dotenv dependency that was causing module not found errors
- Fixed configuration file path to use `.canvaslms-cli-config.json`
- Resolved package publishing and global installation issues

### Added

- Dual binary support: both `canvaslms-cli` and `canvas` commands work

## [1.1.0] - 2025-07-03

### Major Changes

- Home directory configuration system (~/.canvaslms-cli-config.json)
- Interactive configuration setup wizard (`canvas config setup`)
- Configuration management subcommands:
  - `canvas config show` - Display current configuration
  - `canvas config edit` - Edit existing configuration
  - `canvas config path` - Show config file location
  - `canvas config delete` - Remove configuration file
- Automatic configuration validation for all commands
- Improved error handling and user guidance

### Changed

- **BREAKING**: Removed environment variable support (.env files)
- Configuration now stored in user's home directory instead of project directory
- Enhanced configuration validation with better error messages
- Improved user onboarding with guided setup process

### Removed

- dotenv dependency (no longer needed)
- Environment variable fallback support

## [1.0.0] - 2025-07-03

### Added

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

### Features

- 📚 Course listing with favorites support
- 📝 Assignment management with status indicators
- 🚀 Interactive file submission workflow
- 📢 Announcement viewing
- 👤 Profile information display
- 🔧 Direct Canvas API access
- ⚡ Command aliases for faster usage
- 🎨 Color-coded grade display
- 📁 Smart file selection interface

### Technical

- Modular command structure in separate files
- Reusable API client library
- Interactive prompt utilities
- File upload handling with progress indicators
- Error handling and user-friendly messages
- Cross-platform compatibility

## [Unreleased]

### Planned Features

- Assignment creation and editing
- Bulk operations
- Plugin system
- Advanced filtering options
- Export functionality
- Offline mode support
