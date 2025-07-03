/**
 * Config command
 */

const { 
  configExists, 
  readConfig, 
  saveConfig, 
  deleteConfig, 
  getConfigPath 
} = require('../lib/config');
const { createReadlineInterface, askQuestion } = require('../lib/interactive');

async function showConfig() {
  console.log('📋 Canvas CLI Configuration\n');
  
  const configPath = getConfigPath();
  const hasConfig = configExists();
  
  console.log(`Configuration file: ${configPath}`);
  console.log(`Status: ${hasConfig ? '✅ Found' : '❌ Not found'}\n`);
  
  if (hasConfig) {
    const config = readConfig();
    if (config) {
      console.log('Current configuration:');
      console.log(`  🌐 Canvas Domain: ${config.domain || 'Not set'}`);
      console.log(`  🔑 API Token: ${config.token ? config.token.substring(0, 10) + '...' : 'Not set'}`);
      console.log(`  📅 Created: ${config.createdAt ? new Date(config.createdAt).toLocaleString() : 'Unknown'}`);
      console.log(`  🔄 Last Updated: ${config.lastUpdated ? new Date(config.lastUpdated).toLocaleString() : 'Unknown'}`);
    }  } else {
    console.log('❌ No configuration found.');
  }
  
  console.log('\n📚 Available commands:');
  console.log('  canvas config setup      # Interactive setup wizard');
  console.log('  canvas config edit       # Edit existing configuration');
  console.log('  canvas config show       # Show current configuration');
  console.log('  canvas config delete     # Delete configuration file');
  console.log('  canvas config path       # Show configuration file path');
  
  console.log('\n🔧 Manual setup:');
  console.log('1. Get your Canvas API token:');
  console.log('   - Log into your Canvas instance');
  console.log('   - Go to Account → Settings');
  console.log('   - Scroll down to "Approved Integrations"');
  console.log('   - Click "+ New Access Token"');
  console.log('   - Copy the generated token');
  console.log('2. Run "canvas config setup" to configure');
  
  console.log('\n📖 Example usage after setup:');
  console.log('  canvas list              # List starred courses');
  console.log('  canvas list -a           # List all enrolled courses');
  console.log('  canvas submit            # Interactive assignment submission');
  console.log('  canvas profile           # Show user profile');
  console.log('  canvas assignments 12345 # Show assignments for course');
  console.log('  canvas grades            # Show grades for all courses');
}

async function setupConfig() {
  const rl = createReadlineInterface();
  
  try {
    console.log('🚀 Canvas CLI Configuration Setup\n');
    
    // Check if config already exists
    if (configExists()) {
      const config = readConfig();
      console.log('📋 Existing configuration found:');
      console.log(`  Domain: ${config.domain || 'Not set'}`);
      console.log(`  Token: ${config.token ? 'Set (hidden)' : 'Not set'}\n`);
      
      const overwrite = await askQuestion(rl, 'Do you want to overwrite the existing configuration? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('Setup cancelled.');
        return;
      }
      console.log('');
    }
      // Get Canvas domain
    const currentConfig = readConfig();
      let domain = await askQuestion(rl, `Enter your Canvas domain${currentConfig?.domain ? ` (${currentConfig.domain})` : ''}: `);
    if (!domain && currentConfig?.domain) {
      domain = currentConfig.domain;
    }
    
    if (!domain) {
      console.log('❌ Canvas domain is required.');
      return;
    }
    
    // Validate and clean domain
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain.includes('.')) {
      console.log('❌ Invalid domain format. Please enter a valid domain (e.g., school.instructure.com)');
      return;
    }
    
    console.log(`✅ Domain set to: ${domain}\n`);
      // Get API token
    const defaultToken = currentConfig?.token || '';
    let token = await askQuestion(rl, `Enter your Canvas API token${defaultToken ? ' (press Enter to keep current)' : ''}: `);
    if (!token && defaultToken) {
      token = defaultToken;
    }
    
    if (!token) {
      console.log('❌ Canvas API token is required.');
      console.log('\n🔑 To get your API token:');
      console.log('1. Log into your Canvas instance');
      console.log('2. Go to Account → Settings');
      console.log('3. Scroll down to "Approved Integrations"');
      console.log('4. Click "+ New Access Token"');
      console.log('5. Copy the generated token');
      return;
    }
    
    // Validate token format (basic check)
    if (token.length < 10) {
      console.log('❌ API token seems too short. Please check your token.');
      return;
    }
    
    console.log('✅ Token received\n');
    
    // Save configuration
    const saved = saveConfig(domain, token);
    if (saved) {
      console.log('🎉 Configuration setup completed successfully!');
      console.log('\n📝 Next steps:');
      console.log('  canvas list              # Test your setup by listing courses');
      console.log('  canvas profile           # View your profile');
      console.log('  canvas config show       # View your configuration');
    }
    
  } catch (error) {
    console.error(`❌ Setup failed: ${error.message}`);
  } finally {
    rl.close();
  }
}

async function editConfig() {
  const rl = createReadlineInterface();
  
  try {
    if (!configExists()) {
      console.log('❌ No configuration file found. Run "canvas config setup" first.');
      return;
    }
    
    const config = readConfig();
    console.log('✏️  Edit Canvas CLI Configuration\n');
    console.log('Current values:');
    console.log(`  Domain: ${config.domain}`);
    console.log(`  Token: ${config.token ? config.token.substring(0, 10) + '...' : 'Not set'}\n`);
    
    // Edit domain
    const newDomain = await askQuestion(rl, `New Canvas domain (${config.domain}): `);
    const domain = newDomain.trim() || config.domain;
    
    // Edit token
    const changeToken = await askQuestion(rl, 'Change API token? (y/N): ');
    let token = config.token;
    
    if (changeToken.toLowerCase() === 'y' || changeToken.toLowerCase() === 'yes') {
      const newToken = await askQuestion(rl, 'New API token: ');
      if (newToken.trim()) {
        token = newToken.trim();
      }
    }
    
    // Confirm changes
    console.log('\n📋 New configuration:');
    console.log(`  Domain: ${domain}`);
    console.log(`  Token: ${token ? token.substring(0, 10) + '...' : 'Not set'}`);
    
    const confirm = await askQuestion(rl, '\nSave changes? (Y/n): ');
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log('Changes cancelled.');
      return;
    }
    
    const saved = saveConfig(domain, token);
    if (saved) {
      console.log('✅ Configuration updated successfully!');
    }
    
  } catch (error) {
    console.error(`❌ Edit failed: ${error.message}`);
  } finally {
    rl.close();
  }
}

function showConfigPath() {
  console.log(`📁 Configuration file location: ${getConfigPath()}`);
  console.log(`📊 Exists: ${configExists() ? 'Yes' : 'No'}`);
}

function deleteConfigFile() {
  console.log('🗑️  Delete Configuration\n');
  
  if (!configExists()) {
    console.log('❌ No configuration file found.');
    return;
  }
  
  const config = readConfig();
  console.log('Current configuration:');
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Token: ${config.token ? 'Set (hidden)' : 'Not set'}`);
  console.log(`  File: ${getConfigPath()}\n`);
  
  // For safety, require explicit confirmation
  console.log('⚠️  This will permanently delete your Canvas CLI configuration.');
  console.log('You will need to run "canvas config setup" again to use the CLI.');
  console.log('\nTo confirm deletion, type: DELETE');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Confirmation: ', (answer) => {
    if (answer === 'DELETE') {
      deleteConfig();
    } else {
      console.log('Deletion cancelled.');
    }
    rl.close();
  });
}

module.exports = {
  showConfig,
  setupConfig,
  editConfig,
  showConfigPath,
  deleteConfigFile
};
