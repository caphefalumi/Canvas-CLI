/**
 * Raw API commands (get, post, put, delete, query)
 */

const { makeCanvasRequest } = require('../lib/api-client');

/**
 * Create query command handler
 */
function createQueryHandler(method) {
  return async function(endpoint, options) {
    const data = await makeCanvasRequest(method, endpoint, options.query, options.data);
    console.log(JSON.stringify(data, null, 2));
  };
}

module.exports = {
  createQueryHandler
};
