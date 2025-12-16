# Canvas CLI Tool

A modern, user-friendly command-line interface for Canvas LMS. Manage courses, assignments, submissions, grades, and more directly from your terminal.

## Features

- List and filter enrolled/starred courses
- View assignments, grades, and submission status
- Interactive file upload for assignments with visual file browser
- View upcoming due dates and calendar events
- Browse course modules and content
- View course announcements
- Display user profile information
- Modern table displays with adaptive column widths
- Direct access to Canvas API endpoints

## Installation

### Global (Recommended)

```bash
npm install -g canvaslms-cli
```

## Setup

The setup wizard will guide you through:

1. **Getting your Canvas API Token**
   - Log into your Canvas
   - Go to Account → Settings
   - Scroll down to "Approved Integrations"
   - Click "+ New Access Token"
   - Copy the generated token
2. **Configure the CLI**

   ```bash
   canvas config setup
   ```

3. **Entering your credentials**
   - Canvas domain (e.g., `school.instructure.com`)
   - Your API token

## Usage

### Common Commands

```bash
canvas config                    # Configure domain and API token
canvas list                      # List starred courses
canvas list -a                   # List all enrolled courses

# Assignments (supports course name instead of ID)
canvas assignments               # Interactive course selection
canvas assignments "math"        # List assignments for course matching "math"
canvas assignments -s            # Show only submitted assignments
canvas assignments -p            # Show only pending assignments

# Grades (supports course name instead of ID)
canvas grades                    # Interactive course selection + detailed grades
canvas grades "database"         # Show detailed grades for course matching "database"
canvas grades -a                 # Include inactive/completed courses
canvas grades -v                 # Include verbose enrollment details

# Announcements (supports course name instead of ID)
canvas announcements             # Interactive course selection
canvas announcements "software"  # Show announcements for course matching "software"
canvas announcements -l 10       # Show last 10 announcements

# Calendar & Due Dates
canvas calendar                  # View upcoming due dates (next 14 days)
canvas calendar -d 30            # View due dates for next 30 days
canvas calendar -p               # Include past due items (last 7 days)
canvas calendar -a               # Include all courses (not just starred)

# Modules
canvas modules                   # Interactive course selection
canvas modules "algorithms"      # Browse modules for course matching "algorithms"

# Todo List
canvas todo                      # View all pending items across courses
canvas todo -l 10                # Show only 10 items

# Files
canvas files                     # Interactive course file browser
canvas files "math"              # Browse files for course matching "math"

# Groups
canvas groups                    # View your group memberships
canvas groups -m                 # Show group members
canvas groups -v                 # Show detailed group info

# Submission
canvas submit                    # Interactive assignment submission
canvas submit "tools"            # Submit to course matching "tools"
canvas submit -f file.pdf        # Submit specific file
canvas submit --dry-run          # Test submission without uploading

# Profile
canvas profile                   # Show user profile
canvas profile -v                # Show all profile fields
```

### Assignment Submission

The submit command provides an interactive file selection experience with a visual file browser:

```bash
canvas submit                        # Full interactive mode
canvas submit "course name"          # Specify course by name
canvas submit -f <file>              # Submit specific file
canvas submit --dry-run              # Test submission flow without uploading
canvas submit -a                     # Show all courses (not just starred)
```

### Course Grades

```bash
canvas grades                        # Interactive course selection (active courses)
canvas grades "software"             # View grades for course matching "software"
canvas grades --all                  # Include inactive/completed courses
canvas grades --verbose              # Include enrollment details
canvas grades -a -v                  # All courses with verbose details
```

### Calendar & Due Dates

View upcoming assignments and events across all your courses:

```bash
canvas calendar                      # Next 14 days (default)
canvas calendar -d 30                # Next 30 days
canvas calendar -p                   # Include past due (last 7 days)
canvas calendar -a                   # Include all courses
```

### Course Modules

Browse and explore course content and modules:

```bash
canvas modules                       # Interactive course selection
canvas modules "database"            # Browse modules for specific course
canvas modules -a                    # Show all courses
```

### Todo List

See all your pending Canvas items in one place:

```bash
canvas todo                          # View all pending items
canvas todo -l 10                    # Limit to 10 items
```

### Course Files

Browse and download files from your courses:

```bash
canvas files                         # Interactive course selection
canvas files "course name"           # Browse files for specific course
canvas files -a                      # Show all courses
```

### Groups

View your Canvas group memberships:

```bash
canvas groups                        # View all groups
canvas groups -m                     # Show group members
canvas groups -v                     # Verbose mode with details
```

## License

See [LICENSE](LICENSE) for details.
