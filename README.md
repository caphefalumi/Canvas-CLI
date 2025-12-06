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
canvas grades                # Interactive course selection + detailed grades
canvas grades <course-id>    # Show detailed grades for specific course
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

### Viewing Grades

The grades command provides an enhanced, interactive experience:

```bash
canvas grades                        # Interactive course selection (active courses)
canvas grades --all                  # Include inactive/completed courses
canvas grades <course-id>            # Direct course grade view
canvas grades --verbose              # Include enrollment details
canvas grades -a -v                  # All courses with verbose details
```

**Features:**
- 📊 Interactive course selection with grade summary table
- 📝 Detailed assignment breakdown with scores
- ✓ Color-coded status indicators (graded, pending, not done)
- 📈 Calculated totals based on graded assignments
- 📋 Table-formatted overall grades
- 🔍 Option to view all courses including inactive ones
- 🎯 Visual progress tracking with emojis

**What you'll see:**
1. List of all courses with current/final scores
2. Select a course to view detailed breakdown
3. Overall grades (Canvas official + calculated average)
4. Complete assignment list with individual scores
5. Points earned vs points possible
6. Assignment submission status

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
