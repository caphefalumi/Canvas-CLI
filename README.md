# Canvas CLI Tool

A modern, user-friendly command-line interface for Canvas LMS. Manage courses, assignments, submissions, grades, and more directly from your terminal.

## Features

- List and filter enrolled/starred courses
- View assignments, grades, and submission status
- Interactive file upload for assignments
- View course announcements
- Display user profile information
- Direct access to Canvas API endpoints

## Installation

### Global (Recommended)

```bash
npm install -g canvaslms-cli
```

## Setup

1. **Get your Canvas API Token**
   - Log in to Canvas
   - Go to Account → Settings
   - Under Approved Integrations, click + New Access Token
   - Copy the generated token

2. **Configure the CLI**

   ```bash
   canvas config
   ```

3. **Environment Variables**

   Create a `.env` file in your project root:

   ```env
   CANVAS_DOMAIN=your-canvas-domain.instructure.com
   CANVAS_API_TOKEN=your-api-token
   ```

## Usage

### Common Commands

```bash
canvas config                # Configure domain and API token
canvas list                  # List starred courses
canvas list -a               # List all enrolled courses
canvas assignments <course>  # List assignments for a course
canvas grades                # Show grades for all courses
canvas announcements         # Show recent announcements
canvas profile               # Show user profile
canvas submit                # Interactive assignment submission
```

### Assignment Submission

```bash
canvas submit                        # Interactive mode
canvas submit -c <courseId>          # Specify course
canvas submit -a <assignmentId>      # Specify assignment
canvas submit -f <file>              # Submit specific file
```

## Command Reference

| Command         | Alias      | Description                       |
|-----------------|-----------|-----------------------------------|
| `list`          | `l`       | List courses                      |
| `assignments`   | `assign`  | List assignments                  |
| `submit`        | `sub`     | Submit assignment files           |
| `grades`        | `grade`   | Show grades                       |
| `announcements` | `announce`| Show announcements                |
| `profile`       | `me`      | Show user profile                 |
| `config`        | -         | Show configuration                |

## Requirements

- Node.js >= 14.x
- npm >= 6.x
- Valid Canvas LMS API token

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -am 'Add feature'`
6. Push: `git push origin feature-name`
7. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
