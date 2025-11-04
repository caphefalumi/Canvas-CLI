/**
 * Raw API commands (get, post, put, delete, query)
 */

import { makeCanvasRequest } from '../lib/api-client.js';
import type { ApiQueryOptions } from '../types/index.js';

/**
 * Create query command handler
 */
export function createQueryHandler(method: string) {
  return async function(endpoint: string, options: ApiQueryOptions): Promise<void> {
    const data = await makeCanvasRequest(method, endpoint, options.query || [], options.body || null);
    console.log(JSON.stringify(data, null, 2));
  };
}
