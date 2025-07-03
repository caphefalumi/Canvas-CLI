# Canvas CLI

A command line tool for interacting with the Canvas API using the Commander.js package.

## Installation

### Prerequisites
- Node.js (version 14 or higher)
- A Canvas account with API access

### Install Dependencies

```bash
npm install
```

### Testing Your Setup

Before using the Canvas CLI, you can run a setup test to verify everything is configured correctly:

```bash
npm test
```

This will check:

- Node.js version compatibility
- Configuration file existence and format
- Required dependencies
- CLI functionality

### Global Installation (Optional)

To use the `canvas` command globally, install it as a global package:

```bash
npm install -g .
```

Or create a symlink:

```bash
npm link
```

## Configuration

The configuration file should be located at `$HOME/.config/canvas.toml` and follow this format:

```toml
[instance]
default="<nickname>"

[instance.<nickname>]
domain="domain.instructure.com"
token="<API TOKEN>"
```

### Example Configuration

```toml
[instance]
default="myschool"

[instance.myschool]
domain="myschool.instructure.com"
token="1234~abcdefghijklmnopqrstuvwxyz"

[instance.testschool]
domain="test.instructure.com"
token="5678~zyxwvutsrqponmlkjihgfedcba"
```

### Getting Your API Token

1. Log into your Canvas instance
2. Go to Account → Settings
3. Scroll down to "Approved Integrations"
4. Click "+ New Access Token"
5. Give it a purpose and expiration date
6. Copy the generated token

### Testing Configuration

To test that your configuration is working properly:

```bash
canvas get users/self
```

This should return information about your user account.

## Usage

### Basic Syntax

```bash
canvas <method> <endpoint> [options]
```

### Available Commands

#### Basic Commands
- `canvas list` (`l`) - List all currently enrolled courses
- `canvas profile` (`me`) - Show current user profile information
- `canvas config` - Show configuration requirements and current setup

#### Course-Specific Commands
- `canvas assignments <course-id>` (`assign`) - List assignments for a specific course
- `canvas grades [course-id]` (`grade`) - Show grades for all courses or a specific course
- `canvas announcements [course-id]` (`announce`) - Show recent announcements

#### Raw API Commands
- `canvas get <endpoint>` (`g`) - GET request to Canvas API
- `canvas post <endpoint>` (`p`) - POST request to Canvas API  
- `canvas put <endpoint>` - PUT request to Canvas API
- `canvas delete <endpoint>` (`d`) - DELETE request to Canvas API

### Command Options

#### List Command
- `-a, --all` - Include all courses (past, current, and future)
- `-v, --verbose` - Show detailed course information

#### Assignments Command
- `-v, --verbose` - Show detailed assignment information
- `-s, --submitted` - Only show submitted assignments
- `-p, --pending` - Only show pending assignments

#### Announcements Command
- `-l, --limit <number>` - Number of announcements to show (default: 5)

#### Profile Command
- `-v, --verbose` - Show detailed profile information

#### Raw API Commands
- `-q, --query <param>` - Add query parameter (can be used multiple times)
- `-d, --data <data>` - Request body (JSON string or @filename)

### Canvas Instances

If you have multiple Canvas instances configured, you can specify which one to use:

```bash
canvas get users/self -i myschool
```

If no instance is specified, the default instance will be used. If no default is configured, you must specify an instance with every command.

### Examples

#### Using the New Commands

```bash
# List all enrolled courses
canvas list

# List courses with detailed information
canvas list -v

# Show your profile
canvas profile

# Show detailed profile information
canvas profile -v

# List assignments for a specific course
canvas assignments 12345

# Show only submitted assignments
canvas assignments 12345 -s

# Show only pending assignments
canvas assignments 12345 -p

# Show recent announcements from all courses
canvas announcements

# Show announcements for a specific course
canvas announcements 12345

# Show grades for all courses
canvas grades

# Show grades for a specific course
canvas grades 12345
```

#### Basic API Queries

```bash
# Get current user information
canvas get users/self

# Get courses
canvas get courses

# Get specific course
canvas get courses/12345
```

#### Using Query Parameters

```bash
# Get courses with enrollment data
canvas get courses -q include[]=enrollments

# Get assignments with submissions
canvas get courses/12345/assignments -q include[]=submission -q all_dates=true

# Get users in a course
canvas get courses/12345/users -q enrollment_type[]=student
```

#### POST/PUT Requests with JSON Data

```bash
# Create an assignment (JSON string)
canvas post courses/12345/assignments -d '{
  "assignment": {
    "name": "New Assignment",
    "description": "Assignment description",
    "points_possible": 100
  }
}'

# Update an assignment from file
canvas put courses/12345/assignments/67890 -d @assignment.json
```

#### Using Different Instances

```bash
# Use specific instance
canvas get users/self -i testschool

# Use default instance (if configured)
canvas get users/self
```

### Configuration Help

To see configuration file location and format:

```bash
canvas config
```

## API Endpoints

The endpoint parameter should be the unique part of the Canvas API URL. For example:

- Canvas URL: `https://canvas.instructure.com/api/v1/accounts/:account_id/users`
- Command: `canvas get accounts/:account_id/users`

Common endpoints:

- `users/self` - Current user information
- `courses` - List courses
- `courses/:course_id/assignments` - Course assignments
- `courses/:course_id/users` - Course users
- `accounts/:account_id/users` - Account users

## Development

### Running Locally

```bash
node src/index.js <command>
```

### Project Structure

```text
src/
  index.js          # Main CLI application
package.json        # Package configuration
README.md          # This file
```

## License

MIT
