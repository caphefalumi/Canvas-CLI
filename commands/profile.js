/**
 * Profile command
 */

const { makeCanvasRequest } = require('../lib/api-client');

async function showProfile(options) {
  try {
    const user = await makeCanvasRequest('get', 'users/self', ['include[]=email', 'include[]=locale']);
    
    console.log('User Profile:\n');
    console.log(`Name: ${user.name}`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email || 'N/A'}`);
    console.log(`Login ID: ${user.login_id || 'N/A'}`);
    
    if (options.verbose) {
      console.log(`Short Name: ${user.short_name || 'N/A'}`);
      console.log(`Sortable Name: ${user.sortable_name || 'N/A'}`);
      console.log(`Locale: ${user.locale || 'N/A'}`);
      console.log(`Time Zone: ${user.time_zone || 'N/A'}`);
      console.log(`Avatar URL: ${user.avatar_url || 'N/A'}`);
      console.log(`Created: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}`);
    }
    
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    process.exit(1);
  }
}

module.exports = {
  showProfile
};
