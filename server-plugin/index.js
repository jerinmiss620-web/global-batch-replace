import { installBatchRoutes } from './batch-server.js';

export const info = {
    id: 'global-batch-replace',
    name: 'Global Batch Find and Replace',
    description: 'User-scoped search and replacement with previews, verified backups and conflict-aware recovery.',
};
export async function init(router) { installBatchRoutes(router); }
