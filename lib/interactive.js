/**
 * Interactive prompt utilities
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import chalk from 'chalk';

// Key codes for raw terminal input
const KEYS = {
  UP: '\u001b[A',
  DOWN: '\u001b[B',
  LEFT: '\u001b[D',
  RIGHT: '\u001b[C',
  SPACE: ' ',
  ENTER: '\r',
  ESCAPE: '\u001b',
  BACKSPACE: '\u007f',
  TAB: '\t'
};

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Ask a question with validation and retry logic
 */
function askQuestionWithValidation(rl, question, validator, errorMessage) {
  return new Promise(async (resolve) => {
    let answer;
    do {
      answer = await askQuestion(rl, question);
      if (validator(answer)) {
        resolve(answer.trim());
        return;
      } else {
        console.log(errorMessage || 'Invalid input. Please try again.');
      }
    } while (true);
  });
}

/**
 * Ask for confirmation (Y/n format)
 */
async function askConfirmation(rl, question, defaultYes = true, options = {}) {
  const { requireExplicit = false } = options;
  const suffix = defaultYes ? " (Y/n)" : " (y/N)";

  while (true) {
    const answer = await askQuestion(rl, question + suffix + ": ");
    const lower = answer.toLowerCase();

    // If user presses Enter → return defaultYes (true by default)
    if (lower === "") {
      if (!requireExplicit) {
        return defaultYes;
      }
      console.log(chalk.yellow('Please enter "y" or "n" to confirm.'));
      continue;
    }

    // Convert input to boolean
    if (lower === "y" || lower === "yes") {
      return true;
    }
    if (lower === "n" || lower === "no") {
      return false;
    }

    if (!requireExplicit) {
      // If input is something else, fallback to defaultYes
      return defaultYes;
    }

    console.log(chalk.yellow('Please enter "y" or "n" to confirm.'));
  }
}

/**
 * Select from a list of options
 */
async function selectFromList(rl, items, displayProperty = null, allowCancel = true) {
  if (!items || items.length === 0) {
    console.log('No items to select from.');
    return null;
  }
  
  console.log('\nSelect an option:');
  items.forEach((item, index) => {
    const displayText = displayProperty ? item[displayProperty] : item;
    console.log(`${index + 1}. ${displayText}`);
  });
  
  if (allowCancel) {
    console.log('0. Cancel');
  }
  
  const validator = (input) => {
    const num = parseInt(input);
    return !isNaN(num) && num >= (allowCancel ? 0 : 1) && num <= items.length;
  };
  
  const answer = await askQuestionWithValidation(
    rl, 
    '\nEnter your choice: ',
    validator,
    `Please enter a number between ${allowCancel ? '0' : '1'} and ${items.length}.`
  );
  
  const choice = parseInt(answer);
  
  if (choice === 0 && allowCancel) {
    return null;
  }
  
  return items[choice - 1];
}

function getSubfoldersRecursive(startDir = process.cwd()) {
  const result = [];
  function walk(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const baseName = path.basename(fullPath);
          if (['node_modules', '.git', 'dist', 'build'].includes(baseName)) continue;
          result.push(fullPath);
          walk(fullPath); // recurse into subdirectory
        }
      } catch (err) {
        // Optionally log: console.warn(`Skipped unreadable folder: ${fullPath}`);
      }
    }
  }
  walk(startDir);
  return result;
}

/**
 * Get files matching a wildcard pattern
 */
function getFilesMatchingWildcard(pattern, currentDir = process.cwd()) {
  try {
    // Gather all subfolders
    const allFolders = [currentDir, ...getSubfoldersRecursive(currentDir)];
    let allFiles = [];
    for (const folder of allFolders) {
      const files = fs.readdirSync(folder).map(f => path.join(folder, f));
      for (const filePath of files) {
        try {
          if (fs.statSync(filePath).isFile()) {
            allFiles.push(filePath);
          }
        } catch (e) {}
      }
    }
    // Convert wildcard pattern to regex
    let regexPattern;
    let matchFullPath = false;
    if (pattern === '*' || (!pattern.includes('.') && !pattern.includes('/'))) {
      regexPattern = new RegExp('.*', 'i');
      matchFullPath = true;
    } else if (pattern.startsWith('*.')) {
      const extension = pattern.slice(2);
      regexPattern = new RegExp(`\\.${extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    } else if (pattern.includes('*')) {
      regexPattern = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    } else {
      regexPattern = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    const matchedFiles = allFiles.filter(filePath => {
      if (matchFullPath) {
        const relPath = path.relative(currentDir, filePath);
        return regexPattern.test(relPath);
      } else {
        return regexPattern.test(path.basename(filePath));
      }
    });
    return matchedFiles;
  } catch (error) {
    console.error(`Error reading directory: ${error.message}`);
    return [];
  }
}

function pad(str, len) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/**
 * Enhanced file selection with wildcard support
 */
async function selectFilesImproved(rl, currentDir = process.cwd()) {
  const selectedFiles = [];
  console.log(chalk.cyan.bold('\n' + '-'.repeat(50)));
  console.log(chalk.cyan.bold('File Selection'));
  console.log(chalk.cyan('-'.repeat(50)));
  console.log(chalk.yellow('Tips:'));
  console.log('  • Type filename to add individual files');
  console.log('  • Use wildcards: *.html, *.js, *.pdf, etc.');
  console.log('  • Type "browse" to see available files');
  console.log('  • Type "remove" to remove files from selection');
  console.log('  • Type ".." or "back" to return to previous menu');
  console.log('  • Press Enter with no input to finish selection\n');
  while (true) {
    if (selectedFiles.length > 0) {
      console.log(chalk.cyan('\n' + '-'.repeat(50)));
      console.log(chalk.cyan.bold(`Currently selected (${selectedFiles.length} files):`));
      selectedFiles.forEach((file, index) => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(pad(chalk.white((index + 1) + '.'), 5) + pad(path.basename(file), 35) + chalk.gray(size));
      });
      console.log(chalk.cyan('-'.repeat(50)));
    }
    const input = await askQuestion(rl, chalk.bold.cyan('\nAdd file (or press Enter to finish): '));
    if (!input.trim()) break;
    if (input === '..' || input.toLowerCase() === 'back') {
      return selectedFiles;
    }
    if (input.toLowerCase() === 'browse') {
      console.log(chalk.cyan('\n' + '-'.repeat(50)));
      console.log(chalk.cyan.bold('Browsing available files:'));
      try {
        const listedFiles = [];
        function walk(dir) {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const relPath = path.relative(currentDir, fullPath);
            if (['node_modules', '.git', 'dist', 'build'].includes(entry)) continue;
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                walk(fullPath);
              } else if (stat.isFile()) {
                listedFiles.push({ path: fullPath, rel: relPath, size: stat.size });
              }
            } catch (e) { continue; }
          }
        }
        walk(currentDir);
        if (listedFiles.length === 0) {
          console.log(chalk.red('  No suitable files found.'));
        } else {
          listedFiles.forEach((file, index) => {
            const sizeKB = (file.size / 1024).toFixed(1);
            console.log(pad(chalk.white((index + 1) + '.'), 5) + pad(file.rel, 35) + chalk.gray(sizeKB + ' KB'));
          });
        }
      } catch (error) {
        console.log(chalk.red('  Error reading directory: ' + error.message));
      }
      continue;
    }
    if (input.toLowerCase() === 'remove') {
      if (selectedFiles.length === 0) {
        console.log(chalk.red('No files selected to remove.'));
        continue;
      }
      console.log(chalk.cyan('\nSelect file to remove:'));
      selectedFiles.forEach((file, index) => {
        console.log(pad(chalk.white((index + 1) + '.'), 5) + path.basename(file));
      });
      const removeChoice = await askQuestion(rl, chalk.bold.cyan('\nEnter number to remove (or press Enter to cancel): '));
      if (removeChoice.trim()) {
        const removeIndex = parseInt(removeChoice) - 1;
        if (removeIndex >= 0 && removeIndex < selectedFiles.length) {
          const removedFile = selectedFiles.splice(removeIndex, 1)[0];
          console.log(chalk.green(`Removed: ${path.basename(removedFile)}`));
        } else {
          console.log(chalk.red('Invalid selection.'));
        }
      }
      continue;
    }
    let filePath = input;
    let zipRequested = false;
    if (filePath.endsWith(' -zip')) {
      filePath = filePath.slice(0, -5).trim();
      zipRequested = true;
    }
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(currentDir, filePath);
    }
    try {
      if (!fs.existsSync(filePath)) {
        console.log(chalk.red('Error: File not found: ' + input));
        continue;
      }
      const stats = fs.statSync(filePath);
      if (zipRequested) {
        const baseName = path.basename(filePath);
        const zipName = baseName.replace(/\.[^/.]+$/, '') + '.zip';
        const zipPath = path.join(currentDir, zipName);
        const zip = new AdmZip();
        process.stdout.write(chalk.yellow('Zipping, please wait... '));
        if (stats.isDirectory()) {
          zip.addLocalFolder(filePath);
        } else if (stats.isFile()) {
          zip.addLocalFile(filePath);
        } else {
          console.log(chalk.red('Not a file or folder.'));
          continue;
        }
        zip.writeZip(zipPath);
        console.log(chalk.green('Done.'));
        console.log(chalk.green(`Created ZIP: ${zipName}`));
        if (selectedFiles.includes(zipPath)) {
          console.log(chalk.yellow(`File already selected: ${zipName}`));
          continue;
        }
        selectedFiles.push(zipPath);
        const size = (fs.statSync(zipPath).size / 1024).toFixed(1) + ' KB';
        console.log(chalk.green(`Added: ${zipName} (${size})`));
        continue;
      }
      if (stats.isDirectory()) {
        const baseName = path.basename(filePath);
        if (['node_modules', '.git', 'dist', 'build'].includes(baseName)) continue;
        const collectedFiles = [];
        function walk(dir) {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              const baseName = path.basename(fullPath);
              if (['node_modules', '.git', 'dist', 'build'].includes(baseName)) continue;
              walk(fullPath);
            } else if (stat.isFile()) {
              collectedFiles.push(fullPath);
            }
          }
        }
        walk(filePath);
        if (collectedFiles.length === 0) {
          console.log(chalk.yellow(`Folder is empty: ${input}`));
          continue;
        }
        console.log(chalk.cyan(`\nFound ${collectedFiles.length} file(s) in folder "${path.relative(currentDir, filePath)}":`));
        let totalSize = 0;
        collectedFiles.forEach((f, i) => {
          const stat = fs.statSync(f);
          totalSize += stat.size;
          const relativePath = path.relative(currentDir, f);
          console.log(pad(chalk.white((i + 1) + '.'), 5) + pad(relativePath, 35) + chalk.gray((stat.size / 1024).toFixed(1) + ' KB'));
        });
        console.log(chalk.cyan('-'.repeat(50)));
        console.log(chalk.cyan(`Total size: ${(totalSize / 1024).toFixed(1)} KB`));
        const confirmFolder = await askConfirmation(rl, chalk.bold.cyan(`Add all ${collectedFiles.length} files from this folder?`), true);
        if (confirmFolder) {
          const newFiles = collectedFiles.filter(f => !selectedFiles.includes(f));
          selectedFiles.push(...newFiles);
          console.log(chalk.green(`Added ${newFiles.length} new files (${collectedFiles.length - newFiles.length} already selected)`));
        }
        continue;
      }
      if (selectedFiles.includes(filePath)) {
        console.log(chalk.yellow(`File already selected: ${path.basename(filePath)}`));
        continue;
      }
      selectedFiles.push(filePath);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(chalk.green(`Added: ${path.basename(filePath)} (${size})`));
    } catch (error) {
      console.log(chalk.red('Error accessing file: ' + error.message));
    }
  }
  return selectedFiles;
}

/**
 * Interactive file selector with tree view and keyboard navigation
 */
async function selectFilesKeyboard(rl, currentDir = process.cwd()) {
  const selectedFiles = [];
  let expandedFolders = new Set();
  let fileTree = [];
  let fileList = [];
  let currentPath = currentDir;
  let currentIndex = 0;
  let isNavigating = true;
  let viewStartIndex = 0;
  const maxVisibleItems = 15;

  // Setup raw mode for keyboard input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Helper function to build file tree
  function buildFileTree(basePath = currentDir, level = 0, parentPath = '') {
    const tree = [];
    try {
      const entries = fs.readdirSync(basePath).sort();
      
      // Add directories first
      entries.forEach(entry => {
        const fullPath = path.join(basePath, entry);
        const relativePath = parentPath ? `${parentPath}/${entry}` : entry;
        
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory() && !['node_modules', '.git', 'dist', 'build', '.vscode', '.next'].includes(entry)) {
            const isExpanded = expandedFolders.has(fullPath);
            tree.push({
              name: entry,
              path: fullPath,
              relativePath,
              type: 'directory',
              level,
              isExpanded,
              size: 0
            });
            
            // If expanded, add children
            if (isExpanded) {
              const children = buildFileTree(fullPath, level + 1, relativePath);
              tree.push(...children);
            }
          }
        } catch (e) {}
      });
      
      // Add files
      entries.forEach(entry => {
        const fullPath = path.join(basePath, entry);
        const relativePath = parentPath ? `${parentPath}/${entry}` : entry;
        
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            tree.push({
              name: entry,
              path: fullPath,
              relativePath,
              type: 'file',
              level,
              size: stats.size
            });
          }
        } catch (e) {}
      });
    } catch (error) {
      console.log(chalk.red('Error reading directory: ' + error.message));
    }
    
    return tree;
  }

  // Helper function to get file icon based on extension
  function getFileIcon(filename) {
    const ext = path.extname(filename).toLowerCase();
    const icons = {
      '.pdf': '📄', '.doc': '📄', '.docx': '📄', '.txt': '📄',
      '.js': '📜', '.ts': '📜', '.py': '📜', '.java': '📜', '.cpp': '📜', '.c': '📜',
      '.html': '🌐', '.css': '🎨', '.scss': '🎨', '.less': '🎨',
      '.json': '⚙️', '.xml': '⚙️', '.yml': '⚙️', '.yaml': '⚙️',
      '.zip': '📦', '.rar': '📦', '.7z': '📦', '.tar': '📦',
      '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
      '.mp4': '🎬', '.avi': '🎬', '.mov': '🎬', '.mkv': '🎬',
      '.mp3': '🎵', '.wav': '🎵', '.flac': '🎵'
    };
    return icons[ext] || '📋';
  }
  // Helper function to build breadcrumb path
  function buildBreadcrumb() {
    const relativePath = path.relative(currentDir, currentPath);
    if (!relativePath || relativePath === '.') {
      return ''
    }
    
    const parts = relativePath.split(path.sep);
    const breadcrumb = parts.map((part, index) => {
      if (index === parts.length - 1) {
        return chalk.white.bold(part);
      }
      return chalk.gray(part);
    }).join(chalk.gray(' › '));
    
    return chalk.yellow('📂 ') + breadcrumb;
  }

  // Helper function to display the file browser
  function displayBrowser() {
    // Header with keyboard controls at the top
    console.log(chalk.cyan.bold('╭' + '─'.repeat(100) + '╮'));
    console.log(chalk.cyan.bold('│') + chalk.white.bold(' Keyboard File Selector'.padEnd(98)) + chalk.cyan.bold('│'));    console.log(chalk.cyan.bold('├' + '─'.repeat(100) + '┤'));
    // Keyboard controls - compact format at top
    const controls = [
      '↑↓←→:Navigate', 'Space:Select', 'Enter:Open/Finish', 'Backspace:Up', 'a:All', 'c:Clear', 'Esc:Exit'
    ];
    const controlLine = controls.map(c => {
      const [key, desc] = c.split(':');
      return chalk.white(key) + chalk.gray(':') + chalk.gray(desc);
    }).join(chalk.gray(' │ '));
    console.log(chalk.cyan.bold('│ ') + controlLine.padEnd(98) + chalk.cyan.bold(' │'));
    console.log(chalk.cyan.bold('╰' + '─'.repeat(100) + '╯'));
    
    console.log();
      // Breadcrumb path
    console.log(buildBreadcrumb());
    
    // Selected files count
    if (selectedFiles.length > 0) {
      const totalSize = selectedFiles.reduce((sum, file) => {
        try {
          return sum + fs.statSync(file).size;
        } catch {
          return sum;
        }
      }, 0);
      console.log(chalk.green(`✅ Selected: ${selectedFiles.length} files (${(totalSize / 1024).toFixed(1)} KB) - Press Enter to finish`));
    } else {
      console.log(chalk.gray('💡 Use Space to select files, then press Enter to finish'));
    }
    
    console.log();
    
    if (fileList.length === 0) {
      console.log(chalk.yellow('📭 No files found in this directory.'));
      return;
    }
    
    // Display files with tree-like structure
    displayFileTree();
  }
  // Helper function to display files in a horizontal grid layout
  function displayFileTree() {
    const terminalWidth = process.stdout.columns || 80;
    const maxDisplayItems = 50; // Show more items in grid view
    const startIdx = Math.max(0, currentIndex - Math.floor(maxDisplayItems / 2));
    const endIdx = Math.min(fileList.length, startIdx + maxDisplayItems);
    const visibleItems = fileList.slice(startIdx, endIdx);
    
    // Show scroll indicators
    if (startIdx > 0) {
      console.log(chalk.gray(`    ⋮ (${startIdx} items above)`));
    }
    
    // Calculate item width and columns
    const maxItemWidth = Math.max(...visibleItems.map(item => {
      const name = path.basename(item.path);
      return name.length + 4; // 2 for icon + space, 2 for padding
    }));
    
    const itemWidth = Math.min(Math.max(maxItemWidth, 15), 25); // Min 15, max 25 chars
    const columnsPerRow = Math.floor((terminalWidth - 4) / itemWidth); // Leave 4 chars margin
    const actualColumns = Math.max(1, columnsPerRow);
    
    // Group items into rows
    let currentRow = '';
    let itemsInCurrentRow = 0;
    
    visibleItems.forEach((item, index) => {
      const actualIndex = startIdx + index;
      const isSelected = selectedFiles.includes(item.path);
      const isCurrent = actualIndex === currentIndex;
      
      // Get icon and name
      let icon = '';
      if (item.type === 'parent' || item.type === 'directory') {
        icon = '📁';
      } else {
        icon = getFileIcon(path.basename(item.path));
      }
      
      const name = item.name || path.basename(item.path);
      const truncatedName = name.length > itemWidth - 4 ? name.slice(0, itemWidth - 7) + '...' : name;
      
      // Build item display string
      let itemDisplay = `${icon} ${truncatedName}`;
      
      // Apply styling based on state
      if (isCurrent) {
        if (isSelected) {
          itemDisplay = chalk.black.bgGreen(` ${itemDisplay}`.padEnd(itemWidth - 1));
        } else if (item.type === 'parent') {
          itemDisplay = chalk.white.bgBlue(` ${itemDisplay}`.padEnd(itemWidth - 1));
        } else if (item.type === 'directory') {
          itemDisplay = chalk.black.bgCyan(` ${itemDisplay}`.padEnd(itemWidth - 1));
        } else {
          itemDisplay = chalk.black.bgWhite(` ${itemDisplay}`.padEnd(itemWidth - 1));
        }
      } else {
        if (isSelected) {
          itemDisplay = chalk.green(`✓${itemDisplay}`.padEnd(itemWidth));
        } else if (item.type === 'parent') {
          itemDisplay = chalk.blue(` ${itemDisplay}`.padEnd(itemWidth));
        } else if (item.type === 'directory') {
          itemDisplay = chalk.cyan(` ${itemDisplay}`.padEnd(itemWidth));
        } else {
          itemDisplay = chalk.white(` ${itemDisplay}`.padEnd(itemWidth));
        }
      }
      
      // Add to current row
      currentRow += itemDisplay;
      itemsInCurrentRow++;
      
      // Check if we need to start a new row
      if (itemsInCurrentRow >= actualColumns || index === visibleItems.length - 1) {
        console.log(currentRow);
        currentRow = '';
        itemsInCurrentRow = 0;
      }
    });
    
    // Show scroll indicators
    if (endIdx < fileList.length) {
      console.log(chalk.gray(`    ⋮ (${fileList.length - endIdx} items below)`));
    }
    
    console.log();
    
    // Show current position and navigation info
    if (fileList.length > maxDisplayItems) {
      console.log(chalk.gray(`Showing ${startIdx + 1}-${endIdx} of ${fileList.length} items | Current: ${currentIndex + 1}`));
    } else {
      console.log(chalk.gray(`${fileList.length} items | Current: ${currentIndex + 1}`));
    }
    
    // Show grid info
    console.log(chalk.gray(`Grid: ${actualColumns} columns × ${itemWidth} chars | Terminal width: ${terminalWidth}`));
  }
  // Helper function to refresh file list for current directory
  function refreshFileList() {
    fileList = [];
    
    try {
      // Add parent directory option if not at root
      if (currentPath !== currentDir) {
        fileList.push({
          type: 'parent',
          path: path.dirname(currentPath),
          name: '..'
        });
      }
      
      // Read current directory
      const entries = fs.readdirSync(currentPath).sort();
      
      // Add directories first
      entries.forEach(entry => {
        const fullPath = path.join(currentPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          fileList.push({
            type: 'directory',
            path: fullPath,
            name: entry
          });
        }
      });
      
      // Add files
      entries.forEach(entry => {
        const fullPath = path.join(currentPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          fileList.push({
            type: 'file',
            path: fullPath,
            name: entry,
            size: stat.size
          });
        }
      });
      
      // Ensure currentIndex is within bounds
      if (currentIndex >= fileList.length) {
        currentIndex = Math.max(0, fileList.length - 1);
      }
      
    } catch (error) {
      console.error('Error reading directory:', error.message);
      fileList = [];
    }
  }
  // Main keyboard event handler
  function handleKeyInput(key) {
    // Calculate grid dimensions for navigation
    const terminalWidth = process.stdout.columns || 80;
    const maxItemWidth = Math.max(...fileList.map(item => {
      const name = path.basename(item.path);
      return name.length + 4;
    }));
    const itemWidth = Math.min(Math.max(maxItemWidth, 15), 25);
    const columnsPerRow = Math.max(1, Math.floor((terminalWidth - 4) / itemWidth));
    
    switch (key) {
      case KEYS.UP:
        // Move up by one row (subtract columns)
        const newUpIndex = currentIndex - columnsPerRow;
        if (newUpIndex >= 0) {
          currentIndex = newUpIndex;
          displayBrowser();
        }
        break;
        
      case KEYS.DOWN:
        // Move down by one row (add columns)
        const newDownIndex = currentIndex + columnsPerRow;
        if (newDownIndex < fileList.length) {
          currentIndex = newDownIndex;
          displayBrowser();
        }
        break;
        
      case KEYS.LEFT:
        // Move left by one column
        if (currentIndex > 0) {
          currentIndex--;
          displayBrowser();
        }
        break;
        
      case KEYS.RIGHT:
        // Move right by one column
        if (currentIndex < fileList.length - 1) {
          currentIndex++;
          displayBrowser();
        }
        break;
        
      case KEYS.SPACE:
        if (fileList.length > 0) {
          const item = fileList[currentIndex];
          if (item.type === 'file') {
            const index = selectedFiles.indexOf(item.path);
            if (index === -1) {
              selectedFiles.push(item.path);
            } else {
              selectedFiles.splice(index, 1);
            }
            displayBrowser();
          }
        }
        break;         
      case KEYS.ENTER:
        if (fileList.length > 0) {
          const item = fileList[currentIndex];
          if (item.type === 'parent' || item.type === 'directory') {
            currentPath = item.path;
            currentIndex = 0;
            refreshFileList();
            displayBrowser();
          } else {
            // When Enter is pressed on a file, finish selection if files are selected
            if (selectedFiles.length > 0) {
              isNavigating = false;
            }
          }
        } else {
          // Finish selection when directory is empty and Enter is pressed (if files selected)
          if (selectedFiles.length > 0) {
            isNavigating = false;
          }
        }
        break;
        
      case KEYS.BACKSPACE:
        if (currentPath !== currentDir) {
          currentPath = path.dirname(currentPath);
          currentIndex = 0;
          refreshFileList();
          displayBrowser();
        }
        break;
        
      case 'a':
        // Select all files in current directory
        let addedCount = 0;
        fileList.forEach(item => {
          if (item.type === 'file' && !selectedFiles.includes(item.path)) {
            selectedFiles.push(item.path);
            addedCount++;
          }
        });
        if (addedCount > 0) {
          displayBrowser();
        }
        break;

      case 'c':
        // Clear all selections
        selectedFiles.length = 0;
        displayBrowser();
        break;
        
      case KEYS.ESCAPE:
      case '\u001b': // ESC key
        isNavigating = false;
        break;
        
      default:
        // Ignore other keys
        break;
    }
  }

  // Initialize and start navigation
  return new Promise((resolve) => {
    refreshFileList();
    displayBrowser();
    
    process.stdin.on('data', (key) => {
      if (!isNavigating) {
        return;
      }
      
      const keyStr = key.toString();
      handleKeyInput(keyStr);
      
      if (!isNavigating) {
        // Cleanup
        process.stdin.removeAllListeners('data');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        
        // Display completion summary
        if (selectedFiles.length > 0) {
          console.log(chalk.green.bold('✅ File Selection Complete!'));
          console.log(chalk.cyan('-'.repeat(50)));
          
          const totalSize = selectedFiles.reduce((sum, file) => {
            try {
              return sum + fs.statSync(file).size;
            } catch {
              return sum;
            }
          }, 0);
          
          console.log(chalk.white(`Selected ${selectedFiles.length} files (${(totalSize / 1024).toFixed(1)} KB total):`));
          selectedFiles.forEach((file, index) => {
            try {
              const stats = fs.statSync(file);
              const size = (stats.size / 1024).toFixed(1) + ' KB';
              console.log(pad(chalk.green(`${index + 1}.`), 5) + pad(path.basename(file), 35) + chalk.gray(size));
            } catch (e) {
              console.log(pad(chalk.red(`${index + 1}.`), 5) + chalk.red(path.basename(file) + ' (Error reading file)'));
            }
          });
          console.log(chalk.cyan('-'.repeat(50)));
        } else {
          console.log(chalk.yellow('No files selected.'));
        }
        
        resolve(selectedFiles);
      }
    });
  });
}

export {
  createReadlineInterface,
  askQuestion,
  askQuestionWithValidation,
  askConfirmation,
  selectFromList,
  selectFilesImproved,
  selectFilesKeyboard,
  getFilesMatchingWildcard,
  getSubfoldersRecursive,
  pad
};