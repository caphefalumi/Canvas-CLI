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
  TAB: '\t',
  CTRL_C: '\u0003'
};

interface FileListItem {
  type: 'file' | 'directory' | 'parent';
  path: string;
  name: string;
  size?: number;
}

interface AskConfirmationOptions {
  requireExplicit?: boolean;
}

export function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

export function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export function askQuestionWithValidation(
  rl: readline.Interface,
  question: string,
  validator: (input: string) => boolean,
  errorMessage?: string
): Promise<string> {
  return new Promise(async (resolve) => {
    let answer: string;
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
export async function askConfirmation(
  rl: readline.Interface,
  question: string,
  defaultYes: boolean = true,
  options: AskConfirmationOptions = {}
): Promise<boolean> {
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
export async function selectFromList<T>(
  rl: readline.Interface,
  items: T[],
  displayProperty: keyof T | null = null,
  allowCancel: boolean = true
): Promise<T | null> {
  if (!items || items.length === 0) {
    console.log('No items to select from.');
    return null;
  }
  
  console.log('\nSelect an option:');
  items.forEach((item, index) => {
    const displayText = displayProperty && typeof item === 'object' && item !== null ? (item[displayProperty] as any) : item;
    console.log(`${index + 1}. ${displayText}`);
  });
  
  if (allowCancel) {
    console.log('0. Cancel');
  }
  
  const validator = (input: string): boolean => {
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
  
  const selectedItem = items[choice - 1];
  return selectedItem !== undefined ? selectedItem : null;
}

export function getSubfoldersRecursive(startDir: string = process.cwd()): string[] {
  const result: string[] = [];
  function walk(dir: string): void {
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
export function getFilesMatchingWildcard(pattern: string, currentDir: string = process.cwd()): string[] {
  try {
    // Gather all subfolders
    const allFolders = [currentDir, ...getSubfoldersRecursive(currentDir)];
    let allFiles: string[] = [];
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
    let regexPattern: RegExp;
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error reading directory: ${errorMessage}`);
    return [];
  }
}

export function pad(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

/**
 * Enhanced file selection with wildcard support
 */
export async function selectFilesImproved(rl: readline.Interface, currentDir: string = process.cwd()): Promise<string[]> {
  const selectedFiles: string[] = [];
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
        const listedFiles: { path: string; rel: string; size: number; }[] = [];
        function walk(dir: string): void {
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red('  Error reading directory: ' + errorMessage));
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
          if (removedFile) {
            console.log(chalk.green(`Removed: ${path.basename(removedFile)}`));
          }
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
        const collectedFiles: string[] = [];
        function walk(dir: string): void {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.red('Error accessing file: ' + errorMessage));
    }
  }
  return selectedFiles;
}

/**
 * Interactive file selector with tree view and keyboard navigation
 */
export async function selectFilesKeyboard(
  _rl: readline.Interface,
  currentDir: string = process.cwd(),
  allowedExtensions?: string[]
): Promise<string[]> {
  const selectedFiles: string[] = [];
  let fileList: FileListItem[] = [];
  let currentPath = currentDir;
  let currentIndex = 0;
  let isNavigating = true;

  // Save and temporarily remove any existing stdin 'data' listeners so
  // the file browser can take exclusive control of keyboard input.
  // We'll restore them before resolving so other parts of the app (readline,
  // signal handlers, etc.) keep working after the browser exits.
  const prevDataListeners = process.stdin.listeners('data').slice();
  process.stdin.removeAllListeners('data');
  
  // Setup raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Helper function to get file icon based on extension
  function getFileIcon(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const icons: Record<string, string> = {
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
  function buildBreadcrumb(): string {
    const relativePath = path.relative(currentDir, currentPath);
    if (!relativePath || relativePath === '.') {
      return '';
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

  // Track the number of lines displayed for clean updates
  let lastDisplayLines = 0;

  function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  function printAndTrack(message: string = '') {
    console.log(message);
    const width = process.stdout.columns || 80;
    const clean = stripAnsi(message);
    const lines = clean.split('\n');
    let count = 0;
    for (const line of lines) {
      count += Math.max(1, Math.ceil((line.length || 0.5) / width));
    }
    lastDisplayLines += count;
  }

  // Helper to clear previous browser display
  function clearPreviousDisplay(): void {
    if (!process.stdout.isTTY || lastDisplayLines === 0) return;
    for (let i = 0; i < lastDisplayLines; i++) {
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(0);
    }
    process.stdout.cursorTo(0);
  }

  // Helper function to display the file browser
  function displayBrowser(): void {
    clearPreviousDisplay();
    lastDisplayLines = 0;
    
    const breadcrumb = buildBreadcrumb();
    if (breadcrumb) {
      printAndTrack(breadcrumb);
    }
    
    printAndTrack(chalk.gray('💡 ↑↓←→:Navigate Space:Select Enter:Open/Finish Backspace:Up a:All c:Clear r:Reload Esc/Ctrl+C:Exit'));

    // If the caller supplied allowedExtensions, show a visible hint so users
    // know what file types they are allowed to submit for this assignment.
    if (Array.isArray(allowedExtensions) && allowedExtensions.length > 0) {
      const exts = allowedExtensions
        .map(e => (e.startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase()))
        .join(', ');
      printAndTrack(chalk.yellow(`Allowed: ${exts}`));
    }
    
    if (selectedFiles.length > 0) {
      const totalSize = selectedFiles.reduce((sum, file) => {
        try {
          return sum + fs.statSync(file).size;
        } catch {
          return sum;
        }
      }, 0);
      printAndTrack(chalk.green(`✅ Selected: ${selectedFiles.length} files (${(totalSize / 1024).toFixed(1)} KB) - Press Enter to finish`));
    }

    printAndTrack();

    if (fileList.length === 0) {
      printAndTrack(chalk.yellow('📭 No files found in this directory.'));
      return;
    }
    
    displayFileTree();
  }

  function displayFileTree(): void {
    const terminalWidth = process.stdout.columns || 80;
    const maxDisplayItems = 50;
    const startIdx = Math.max(0, currentIndex - Math.floor(maxDisplayItems / 2));
    const endIdx = Math.min(fileList.length, startIdx + maxDisplayItems);
    const visibleItems = fileList.slice(startIdx, endIdx);
    
    if (startIdx > 0) {
      printAndTrack(chalk.gray(`    ⋮ (${startIdx} items above)`));
    }
    
    const maxItemWidth = Math.max(...visibleItems.map(item => {
      const name = path.basename(item.path);
      return name.length + 4;
    }));
    
    const itemWidth = Math.min(Math.max(maxItemWidth, 15), 25);
    const columnsPerRow = Math.max(1, Math.floor((terminalWidth - 4) / itemWidth));
    
    let currentRow = '';
    let itemsInCurrentRow = 0;
    
    visibleItems.forEach((item, index) => {
      const actualIndex = startIdx + index;
      const isSelected = selectedFiles.includes(item.path);
      const isCurrent = actualIndex === currentIndex;
      
      let icon = '';
      if (item.type === 'parent' || item.type === 'directory') {
        icon = '📁';
      } else {
        icon = getFileIcon(path.basename(item.path));
      }
      
      const name = item.name || path.basename(item.path);
      const truncatedName = name.length > itemWidth - 4 ? name.slice(0, itemWidth - 7) + '...' : name;
      
      let itemDisplay = `${icon} ${truncatedName}`;
      
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
      
      currentRow += itemDisplay;
      itemsInCurrentRow++;
      
      if (itemsInCurrentRow >= columnsPerRow || index === visibleItems.length - 1) {
        printAndTrack(currentRow);
        currentRow = '';
        itemsInCurrentRow = 0;
      }
    });
    
    if (endIdx < fileList.length) {
      printAndTrack(chalk.gray(`    ⋮ (${fileList.length - endIdx} items below)`));
    }
    
    printAndTrack();
    
    if (fileList.length > maxDisplayItems) {
      printAndTrack(chalk.gray(`Showing ${startIdx + 1}-${endIdx} of ${fileList.length} items | Current: ${currentIndex + 1}`));
    } else {
      printAndTrack(chalk.gray(`${fileList.length} items | Current: ${currentIndex + 1}`));
    }
    
    const columnsInfo = `Grid: ${columnsPerRow} columns × ${itemWidth} chars | Terminal width: ${terminalWidth}`;
    printAndTrack(chalk.gray(columnsInfo));
  }

  function refreshFileList(): void {
    fileList = [];
    
    try {
      if (currentPath !== currentDir) {
        fileList.push({
          type: 'parent',
          path: path.dirname(currentPath),
          name: '..'
        });
      }
      
      const entries = fs.readdirSync(currentPath).sort();
      
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
      
      entries.forEach(entry => {
        const fullPath = path.join(currentPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          // If allowedExtensions is provided, filter files that don't match
          if (Array.isArray(allowedExtensions) && allowedExtensions.length > 0) {
            const lowerExts = allowedExtensions.map(e => (e.startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase()));
            const ext = path.extname(entry).toLowerCase();
            if (!lowerExts.includes(ext)) {
              // Skip files that are not allowed for this assignment
              return;
            }
          }

          fileList.push({
            type: 'file',
            path: fullPath,
            name: entry,
            size: stat.size
          });
        }
      });
      
      if (currentIndex >= fileList.length) {
        currentIndex = Math.max(0, fileList.length - 1);
      }
      
    } catch (error) {
      console.error('Error reading directory:', error);
      fileList = [];
    }
  }

  function handleKeyInput(key: string): void {
    const terminalWidth = process.stdout.columns || 80;
    const maxItemWidth = Math.max(...fileList.map(item => {
      const name = path.basename(item.path);
      return name.length + 4;
    }));
    const itemWidth = Math.min(Math.max(maxItemWidth, 15), 25);
    const columnsPerRow = Math.max(1, Math.floor((terminalWidth - 4) / itemWidth));
    
    switch (key) {
      case KEYS.UP:
        const newUpIndex = currentIndex - columnsPerRow;
        if (newUpIndex >= 0) {
          currentIndex = newUpIndex;
          displayBrowser();
        }
        break;
        
      case KEYS.DOWN:
        const newDownIndex = currentIndex + columnsPerRow;
        if (newDownIndex < fileList.length) {
          currentIndex = newDownIndex;
          displayBrowser();
        }
        break;
        
      case KEYS.LEFT:
        if (currentIndex > 0) {
          currentIndex--;
          displayBrowser();
        }
        break;
        
      case KEYS.RIGHT:
        if (currentIndex < fileList.length - 1) {
          currentIndex++;
          displayBrowser();
        }
        break;
        
      case KEYS.SPACE:
        if (fileList.length > 0) {
          const item = fileList[currentIndex];
          if (item && item.type === 'file') {
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
          if (item && (item.type === 'parent' || item.type === 'directory')) {
            currentPath = item.path;
            currentIndex = 0;
            refreshFileList();
            displayBrowser();
          } else {
            if (selectedFiles.length > 0) {
              isNavigating = false;
            }
          }
        } else {
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
        selectedFiles.length = 0;
        displayBrowser();
        break;

      case 'r':
        // Reload the current directory listing
        refreshFileList();
        displayBrowser();
        break;
        
      case KEYS.CTRL_C:
        selectedFiles.length = 0;
        isNavigating = false;
        break;
        
      case KEYS.ESCAPE:
      case '\u001b':
        isNavigating = false;
        break;
        
      default:
        break;
    }
  }

  return new Promise((resolve) => {
    refreshFileList();
    displayBrowser();
    
    const onData = (key: Buffer) => {
      if (!isNavigating) {
        return;
      }
      
      const keyStr = key.toString();
      handleKeyInput(keyStr);
      
      if (!isNavigating) {
        // Clean up event listener and terminal state
        process.stdin.removeListener('data', onData);

        // Restore any previously attached 'data' listeners so callers like
        // readline keep working as expected.
        try {
          for (const l of prevDataListeners) {
            process.stdin.on('data', l as (...args: any[]) => void);
          }
        } catch {
          // If restoration fails for any reason, continue with cleanup.
        }

        // Always reset terminal to a safe state
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();

        // Display final selection
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
        }
        
        resolve(selectedFiles);
      }
    };

    process.stdin.on('data', onData);
  });
}
