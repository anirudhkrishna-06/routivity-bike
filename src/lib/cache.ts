import { Redis } from "@upstash/redis";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

export async function invalidateTripCache(tripId: string) {
  if (!redis) return;
  await redis.del(`trip:${tripId}`, `trip:${tripId}:itinerary`, `trip:${tripId}:activity-log`);
}
