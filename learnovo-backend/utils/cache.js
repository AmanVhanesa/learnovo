const NodeCache = require('node-cache');

/**
 * Lightweight in-memory cache (wraps node-cache).
 *
 * Default TTLs (seconds):
 *   tenant/settings  → 600  (10 min)
 *   classes/sections  → 300  (5 min)
 *   dashboard stats   → 120  (2 min)
 *   S3 pre-signed URL → 3000 (50 min – they expire at 60 min)
 */

const cache = new NodeCache({
  stdTTL: 300,           // default 5 min
  checkperiod: 120,      // purge expired keys every 2 min
  useClones: false,      // return references (faster, saves memory)
  maxKeys: 500,          // prevent unbounded memory growth
  deleteOnExpire: true,  // remove keys immediately on expiry
});

/** Get a value by key (returns undefined on miss). */
const get = (key) => cache.get(key);

/** Set a value with optional TTL override (seconds). */
const set = (key, value, ttlSeconds) =>
  cache.set(key, value, ttlSeconds ?? 300);

/** Delete a single key. */
const del = (key) => cache.del(key);

/**
 * Delete all keys that start with `prefix`.
 * Useful for tenant-scoped invalidation, e.g. delByPrefix(`tenant:${tenantId}:`).
 */
const delByPrefix = (prefix) => {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  if (keys.length) cache.del(keys);
  return keys.length;
};

/** Flush every key. */
const flush = () => cache.flushAll();

/** Wrap an async fn with cache (get-or-set pattern). */
const getOrSet = async (key, fn, ttlSeconds) => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = await fn();
  cache.set(key, value, ttlSeconds ?? 300);
  return value;
};

/** Get cache statistics (hits, misses, keys count). */
const getStats = () => ({
  keys: cache.keys().length,
  hits: cache.getStats().hits,
  misses: cache.getStats().misses,
});

module.exports = { get, set, del, delByPrefix, flush, getOrSet, getStats };
