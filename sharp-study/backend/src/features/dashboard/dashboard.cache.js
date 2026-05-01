const { deleteCacheByPrefix } = require('../../utils/cache');

const DASHBOARD_CACHE_PREFIX = 'dashboard:';

function dashboardCacheKey(userId, limit = 12) {
  return `${DASHBOARD_CACHE_PREFIX}${userId}:limit:${limit}`;
}

function invalidateDashboardCache(userId) {
  if (!userId) return;
  deleteCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}${userId}:`);
}

module.exports = {
  dashboardCacheKey,
  invalidateDashboardCache,
};
