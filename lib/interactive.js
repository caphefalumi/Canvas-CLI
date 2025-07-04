/**
 * Interactive prompt utilities
 */

const readline = require('readline');

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

module.exports = {
  createReadlineInterface,
  askQuestion,
  askQuestionWithValidation,
  askConfirmation,
  selectFromList
};
