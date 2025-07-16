/**
 * Interactive prompt utilities
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import chalk from 'chalk';

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
async function askConfirmation(rl, question, defaultYes = true) {
  const suffix = defaultYes ? ' (Y/n)' : ' (y/N)';
  const answer = await askQuestion(rl, question + suffix + ': ');
  
  if (answer.trim() === '') {
    return defaultYes;
  }
  
  const lower = answer.toLowerCase();
  return lower === 'y' || lower === 'yes';
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
  console.log(chalk.cyan.bold('Enhanced File Selection'));
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


export {
  createReadlineInterface,
  askQuestion,
  askQuestionWithValidation,
  askConfirmation,
  selectFromList,
  selectFilesImproved,
  getFilesMatchingWildcard,
  getSubfoldersRecursive,
  pad
};