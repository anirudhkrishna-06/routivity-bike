import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

/**
 * Standardized Redis keys for a trip
 */
export function tripCacheKeys(tripId: string): string[] {
  return [
    `trip:${tripId}:dashboard`,
    `trip:${tripId}:itinerary`,
    `trip:${tripId}:money`,
    `trip:${tripId}:activity-log`,
    `trip:${tripId}:meta`,
    `trip:${tripId}`,
  ];
}

/**
 * Robust Cache-Aside pattern:
 * 1. Checks Redis cache.
 * 2. On hit, returns cached value.
 * 3. On miss or Redis failure, calls fetcher(), sets cache in background with TTL, and returns value.
 * 4. Never throws if Redis fails or times out.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch (error) {
    // Non-blocking: log warning and continue to database
    console.warn(`[Cache Warning] Failed to read key "${key}":`, error);
  }

  // Cache miss or Redis read error: fetch from primary source
  const data = await fetcher();

  // Populate cache non-blockingly
  try {
    if (data !== null && data !== undefined) {
      await redis.set(key, data, { ex: ttlSeconds });
    }
  } catch (error) {
    console.warn(`[Cache Warning] Failed to write key "${key}":`, error);
  }

  return data;
}

/**
 * Resilient cache invalidation:
 * Purges all related keys for a trip.
 * Wrapped in try/catch so Redis outages or rate limits never fail database transactions or mutations.
 */
export async function invalidateTripCache(tripId: string): Promise<void> {
  if (!redis) return;

  try {
    const keys = tripCacheKeys(tripId);
    await redis.del(...keys);
  } catch (error) {
    console.warn(`[Cache Warning] Failed to invalidate cache for trip "${tripId}":`, error);
  }
}
