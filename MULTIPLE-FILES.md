# Multiple File Submission Guide

## Overview
The Canvas CLI now supports submitting multiple files to a single assignment through the interactive `canvas submit` command.

## Multiple File Selection Methods

### Method 1: Manual File Paths
When you choose option 1 (Enter file path(s) manually), you can:
- Choose single file: Just enter one file path
- Choose multiple files: Select 'm' and enter file paths one by one (press Enter on empty line to finish)

### Method 2: Current Directory Selection
When you choose option 2 (Select from current directory), you can:

#### Single File Selection:
- Answer 'N' to "Select multiple files?"
- Enter a single file number

#### Multiple File Selection:
- Answer 'Y' to "Select multiple files?"
- Use comma-separated numbers: `1,3,5`
- Use ranges: `1-3` (selects files 1, 2, and 3)
- Use combination: `1,3-5,7` (selects files 1, 3, 4, 5, and 7)

## Examples

### Example 1: Comma-separated Selection
```
Files in current directory:
1. test-submission.txt (0.2 KB)
2. test-file-2.js (0.3 KB)
3. test-file-3.md (0.4 KB)
4. README.md (5.2 KB)

File numbers: 1,3,4
```
This selects files 1, 3, and 4.

### Example 2: Range Selection
```
File numbers: 1-3
```
This selects files 1, 2, and 3.

### Example 3: Mixed Selection
```
File numbers: 1,3-5,7
```
This selects files 1, 3, 4, 5, and 7.

## Upload Process
1. Each file is uploaded individually with progress tracking
2. If one file fails, you can choose to continue with remaining files
3. All successfully uploaded files are submitted together
4. Final confirmation shows the number of files submitted

## Features
- ✅ File validation before upload
- ✅ Progress tracking for each file
- ✅ Error handling with option to continue
- ✅ Size display for file selection
- ✅ Duplicate removal in selections
- ✅ Range and comma-separated input parsing
