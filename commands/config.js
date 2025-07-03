/**
 * Config command
 */

async function showConfig() {
  console.log('Configuration using environment variables:\n');
  
  const domain = process.env.CANVAS_DOMAIN;
  const token = process.env.CANVAS_API_TOKEN;
  
  console.log('Required environment variables:');
  console.log(`  CANVAS_DOMAIN: ${domain ? '✓ Set (' + domain + ')' : '✗ Not set'}`);
  console.log(`  CANVAS_API_TOKEN: ${token ? '✓ Set (' + token.substring(0, 10) + '...)' : '✗ Not set'}`);
  
  if (!domain || !token) {
    console.log('\nTo configure:');
    console.log('1. Create a .env file in the project root');
    console.log('2. Add the following lines:');
    console.log('   CANVAS_DOMAIN=your-canvas-domain.instructure.com');
    console.log('   CANVAS_API_TOKEN=your-api-token');
    console.log('\nTo get your API token:');
    console.log('1. Log into your Canvas instance');
    console.log('2. Go to Account → Settings');
    console.log('3. Scroll down to "Approved Integrations"');
    console.log('4. Click "+ New Access Token"');
    console.log('5. Copy the generated token');
  } else {
    console.log('\n✅ Configuration looks good!');
  }
  
  console.log('\nExample usage:');
  console.log('  canvas list              # List starred courses (default)');
  console.log('  canvas list -a           # List all enrolled courses');
  console.log('  canvas list -v           # List starred courses with details');
  console.log('  canvas list -a -v        # List all courses with details');
  console.log('  canvas submit            # Interactive assignment submission (single/multiple files)');
  console.log('  canvas profile           # Show user profile');
  console.log('  canvas assignments 12345 # Show assignments for course');
  console.log('  canvas grades            # Show grades for all courses');
  console.log('  canvas announcements     # Show recent announcements');
  console.log('  canvas get users/self    # Get current user info (raw API)');
  console.log('  canvas get courses       # Get courses (raw API)');
}

module.exports = {
  showConfig
};
