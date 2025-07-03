# Canvas CLI Tool

A powerful command-line interface for interacting with Canvas LMS API. This tool allows you to manage courses, assignments, submissions, and more directly from your terminal.

## Features

- 📚 **Course Management**: List starred and enrolled courses
- 📝 **Assignment Operations**: View assignments, grades, and submission status
- 🚀 **File Submission**: Interactive file upload for assignments (single or multiple files)
- 📢 **Announcements**: View course announcements
- 👤 **Profile Management**: View user profile information
- 🔧 **Raw API Access**: Direct access to Canvas API endpoints

## Installation

### Global Installation (Recommended)

```bash
npm install -g canvas-cli-tool
```

### Local Installation

```bash
npm install canvas-cli-tool
```

## Setup

1. **Get your Canvas API token**:
   - Log into your Canvas instance
   - Go to Account → Settings
   - Scroll down to "Approved Integrations"
   - Click "+ New Access Token"
   - Copy the generated token

2. **Configure the CLI**:
   ```bash
   canvas config
   ```

3. **Create a `.env` file** in your project root:
   ```env
   CANVAS_DOMAIN=your-canvas-domain.instructure.com
   CANVAS_API_TOKEN=your-api-token
   ```

## Usage

### Basic Commands

```bash
# Show configuration help
canvas config

# List starred courses (default)
canvas list

# List all enrolled courses
canvas list -a

# List courses with detailed information
canvas list -v

# Show user profile
canvas profile

# Show detailed profile information
canvas profile -v
```

### Assignment Operations

```bash
# List assignments for a course
canvas assignments 12345

# Show detailed assignment information
canvas assignments 12345 -v

# Show only submitted assignments
canvas assignments 12345 -s

# Show only pending assignments
canvas assignments 12345 -p
```

### File Submission

```bash
# Interactive assignment submission
canvas submit

# Submit with specific course ID
canvas submit -c 12345

# Submit with specific assignment ID
canvas submit -a 67890

# Submit specific file
canvas submit -f myfile.pdf
```

### Grades and Announcements

```bash
# Show grades for all courses
canvas grades

# Show grades for specific course
canvas grades 12345

# Show recent announcements
canvas announcements

# Show announcements for specific course
canvas announcements 12345
```

### Raw API Access

```bash
# GET request
canvas get users/self

# GET with query parameters
canvas get courses -q enrollment_state=active

# POST request with data
canvas post courses/123/assignments -d '{"assignment": {"name": "Test"}}'

# POST with data from file
canvas post courses/123/assignments -d @assignment.json
```

## Command Reference

| Command | Alias | Description |
|---------|-------|-------------|
| `list` | `l` | List courses |
| `assignments` | `assign` | List assignments |
| `submit` | `sub` | Submit assignment files |
| `grades` | `grade` | Show grades |
| `announcements` | `announce` | Show announcements |
| `profile` | `me` | Show user profile |
| `config` | - | Show configuration |
| `get` | `g` | GET API request |
| `post` | `p` | POST API request |
| `put` | - | PUT API request |
| `delete` | `d` | DELETE API request |

## File Structure

```
canvas-cli-tool/
├── src/
│   └── index.js          # Main CLI entry point
├── lib/
│   ├── api-client.js     # Canvas API client
│   ├── config.js         # Configuration management
│   ├── file-upload.js    # File upload utilities
│   └── interactive.js    # Interactive prompt utilities
├── commands/
│   ├── list.js           # List courses command
│   ├── assignments.js    # Assignments command
│   ├── submit.js         # Submit command
│   ├── grades.js         # Grades command
│   ├── announcements.js  # Announcements command
│   ├── profile.js        # Profile command
│   ├── config.js         # Config command
│   └── api.js            # Raw API commands
└── package.json
```

## Requirements

- Node.js >= 14.0.0
- npm >= 6.0.0
- Valid Canvas LMS access with API token

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.
