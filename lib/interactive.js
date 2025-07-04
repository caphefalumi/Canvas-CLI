/**
 * Interactive prompt utilities
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

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

/**
 * Get files matching a wildcard pattern
 */
function getFilesMatchingWildcard(pattern, currentDir = process.cwd()) {
  try {
    const files = fs.readdirSync(currentDir);
    const matchedFiles = [];
    
    // Convert wildcard pattern to regex
    let regexPattern;
    if (pattern.startsWith('*.')) {
      // Handle *.extension patterns
      const extension = pattern.slice(2);
      regexPattern = new RegExp(`\\.${extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    } else if (pattern.includes('*')) {
      // Handle other wildcard patterns
      regexPattern = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    } else {
      // Exact match
      regexPattern = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    
    files.forEach(file => {
      const filePath = path.join(currentDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && regexPattern.test(file)) {
        matchedFiles.push(filePath);
      }
    });
    
    return matchedFiles;
  } catch (error) {
    console.error(`Error reading directory: ${error.message}`);
    return [];
  }
}

/**
 * Enhanced file selection with wildcard support
 */
async function selectFilesImproved(rl, currentDir = process.cwd()) {
  const selectedFiles = [];
  
  console.log('\n📁 Enhanced File Selection');
  console.log('💡 Tips:');
  console.log('  • Type filename to add individual files');
  console.log('  • Use wildcards: *.html, *.js, *.pdf, etc.');
  console.log('  • Type "browse" to see available files');
  console.log('  • Type "remove" to remove files from selection');
  console.log('  • Press Enter with no input to finish selection\n');
  
  while (true) {
    // Show current selection
    if (selectedFiles.length > 0) {
      console.log(`\n📋 Currently selected (${selectedFiles.length} files):`);
      selectedFiles.forEach((file, index) => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(`  ${index + 1}. ${path.basename(file)} (${size})`);
      });
    }
    
    const input = await askQuestion(rl, '\n📎 Add file (or press Enter to finish): ');
    
    if (!input.trim()) {
      // Empty input - finish selection
      break;
    }
    
    if (input.toLowerCase() === 'browse') {
      // Show available files
      console.log('\n📂 Available files in current directory:');
      try {
        const files = fs.readdirSync(currentDir);
        const filteredFiles = files.filter(file => {
          const filePath = path.join(currentDir, file);
          const stats = fs.statSync(filePath);
          return stats.isFile() && 
                 !file.startsWith('.') && 
                 !['package.json', 'package-lock.json', 'node_modules'].includes(file);
        });
        
        if (filteredFiles.length === 0) {
          console.log('  No suitable files found.');
        } else {
          filteredFiles.forEach((file, index) => {
            const filePath = path.join(currentDir, file);
            const stats = fs.statSync(filePath);
            const size = (stats.size / 1024).toFixed(1) + ' KB';
            const ext = path.extname(file);
            const icon = getFileIcon(ext);
            console.log(`  ${index + 1}. ${icon} ${file} (${size})`);
          });
        }
      } catch (error) {
        console.log(`  Error reading directory: ${error.message}`);
      }
      continue;
    }
    
    if (input.toLowerCase() === 'remove') {
      // Remove files from selection
      if (selectedFiles.length === 0) {
        console.log('❌ No files selected to remove.');
        continue;
      }
      
      console.log('\nSelect file to remove:');
      selectedFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${path.basename(file)}`);
      });
      
      const removeChoice = await askQuestion(rl, '\nEnter number to remove (or press Enter to cancel): ');
      if (removeChoice.trim()) {
        const removeIndex = parseInt(removeChoice) - 1;
        if (removeIndex >= 0 && removeIndex < selectedFiles.length) {
          const removedFile = selectedFiles.splice(removeIndex, 1)[0];
          console.log(`✅ Removed: ${path.basename(removedFile)}`);
        } else {
          console.log('❌ Invalid selection.');
        }
      }
      continue;
    }
    
    // Check if input contains wildcards
    if (input.includes('*') || input.includes('?')) {
      const matchedFiles = getFilesMatchingWildcard(input, currentDir);
      
      if (matchedFiles.length === 0) {
        console.log(`❌ No files found matching pattern: ${input}`);
        continue;
      }
      
      console.log(`\n🎯 Found ${matchedFiles.length} files matching "${input}":`);
      matchedFiles.forEach((file, index) => {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(1) + ' KB';
        console.log(`  ${index + 1}. ${path.basename(file)} (${size})`);
      });
      
      const confirmAll = await askConfirmation(rl, `Add all ${matchedFiles.length} files?`, true);
      
      if (confirmAll) {
        const newFiles = matchedFiles.filter(file => !selectedFiles.includes(file));
        selectedFiles.push(...newFiles);
        console.log(`✅ Added ${newFiles.length} new files (${matchedFiles.length - newFiles.length} were already selected)`);
      }
      continue;
    }
    
    // Handle individual file selection
    let filePath = input;
    
    // If not absolute path, make it relative to current directory
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(currentDir, filePath);
    }
    
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${input}`);
        continue;
      }
      
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        console.log(`❌ Not a file: ${input}`);
        continue;
      }
      
      if (selectedFiles.includes(filePath)) {
        console.log(`⚠️  File already selected: ${path.basename(filePath)}`);
        continue;
      }
      
      selectedFiles.push(filePath);
      const size = (stats.size / 1024).toFixed(1) + ' KB';
      console.log(`✅ Added: ${path.basename(filePath)} (${size})`);
      
    } catch (error) {
      console.log(`❌ Error accessing file: ${error.message}`);
    }
  }
  
  return selectedFiles;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(extension) {
  const iconMap = {
    '.js': '📜',
    '.html': '🌐',
    '.css': '🎨',
    '.pdf': '📄',
    '.doc': '📝',
    '.docx': '📝',
    '.txt': '📄',
    '.md': '📖',
    '.json': '⚙️',
    '.xml': '📋',
    '.zip': '📦',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️'
  };
  
  return iconMap[extension.toLowerCase()] || '📎';
}

module.exports = {
  createReadlineInterface,
  askQuestion,
  askQuestionWithValidation,
  askConfirmation,
  selectFromList,
  selectFilesImproved,
  getFilesMatchingWildcard
};
