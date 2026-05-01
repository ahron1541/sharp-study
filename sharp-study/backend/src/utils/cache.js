const store = new Map();

function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

function setCache(key, value, ttlSeconds = 60) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function deleteCache(key) {
  store.delete(key);
}

function deleteCacheByPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPrefix,
};
