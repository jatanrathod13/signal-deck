/**
 * CacheService
 * Bounded in-memory TTL cache with namespace-based invalidation and basic metrics.
 */

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  entries: number;
  maxEntries: number;
  defaultTtlMs: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  touchedAt: number;
}

const DEFAULT_CACHE_TTL_MS = Number.parseInt(process.env.CACHE_DEFAULT_TTL_MS ?? '5000', 10);
const CACHE_MAX_ENTRIES = Number.parseInt(process.env.CACHE_MAX_ENTRIES ?? '500', 10);

const store = new Map<string, CacheEntry<unknown>>();

const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

function resolveTtl(ttlMs: number | undefined): number {
  if (typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0) {
    return Math.floor(ttlMs);
  }

  if (Number.isFinite(DEFAULT_CACHE_TTL_MS) && DEFAULT_CACHE_TTL_MS > 0) {
    return DEFAULT_CACHE_TTL_MS;
  }

  return 5000;
}

function resolveMaxEntries(): number {
  if (Number.isFinite(CACHE_MAX_ENTRIES) && CACHE_MAX_ENTRIES > 0) {
    return CACHE_MAX_ENTRIES;
  }

  return 500;
}

function purgeExpired(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
      stats.evictions += 1;
    }
  }
}

function evictIfNeeded(now: number): void {
  purgeExpired(now);

  const maxEntries = resolveMaxEntries();
  if (store.size < maxEntries) {
    return;
  }

  let oldestKey: string | undefined;
  let oldestTouchedAt = Number.MAX_SAFE_INTEGER;

  for (const [key, entry] of store.entries()) {
    if (entry.touchedAt < oldestTouchedAt) {
      oldestKey = key;
      oldestTouchedAt = entry.touchedAt;
    }
  }

  if (oldestKey) {
    store.delete(oldestKey);
    stats.evictions += 1;
  }
}

export function buildCacheKey(parts: Array<string | number | boolean | undefined | null>): string {
  return parts
    .filter((part) => part !== undefined && part !== null)
    .map((part) => String(part))
    .join(':');
}

export function getCachedValue<T>(key: string): T | undefined {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    stats.misses += 1;
    return undefined;
  }

  if (entry.expiresAt <= now) {
    store.delete(key);
    stats.misses += 1;
    stats.evictions += 1;
    return undefined;
  }

  entry.touchedAt = now;
  stats.hits += 1;
  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs?: number): void {
  const now = Date.now();
  evictIfNeeded(now);

  store.set(key, {
    value,
    expiresAt: now + resolveTtl(ttlMs),
    touchedAt: now
  });

  stats.sets += 1;
}

export function invalidateCachePrefix(prefix: string): number {
  let removed = 0;
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }

  if (removed > 0) {
    stats.evictions += removed;
  }

  return removed;
}

export function clearCache(): void {
  const size = store.size;
  store.clear();
  if (size > 0) {
    stats.evictions += size;
  }
}

export function getCacheStats(): CacheStats {
  return {
    ...stats,
    entries: store.size,
    maxEntries: resolveMaxEntries(),
    defaultTtlMs: resolveTtl(undefined)
  };
}
