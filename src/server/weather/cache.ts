import "server-only";

import { Redis } from "@upstash/redis";

import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

import type { Reading } from "./service";

/** ARCHITECTURE §5.5: 30 minutes, shared by everyone near the same rounded point. */
const TTL_SECONDS = 30 * 60;

let redis: Redis | null | undefined;
const memory = new Map<string, { reading: Reading; expires: number }>();

function shared(): Redis | null {
  if (redis === undefined) {
    redis =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
        : null;
  }
  return redis;
}

/** Coordinates rounded to 0.1° (about 11 km): neighbours share one reading. */
export function weatherKey(latitude: number, longitude: number): string {
  return `cooky:wx:${latitude.toFixed(1)}:${longitude.toFixed(1)}`;
}

/** A cached reading, or a fresh one from `load` that is then cached. Cache trouble never blocks the reading. */
export async function cachedReading(key: string, load: () => Promise<Reading>): Promise<Reading> {
  const redisClient = shared();
  if (redisClient) {
    try {
      const hit = await redisClient.get<Reading>(key);
      if (hit) return hit;
    } catch (err) {
      logger.warn({ err }, "weather cache read failed");
    }
  } else {
    const hit = memory.get(key);
    if (hit && hit.expires > Date.now()) return hit.reading;
  }
  const reading = await load();
  if (redisClient) {
    await redisClient.set(key, reading, { ex: TTL_SECONDS }).catch((err: unknown) => {
      logger.warn({ err }, "weather cache write failed");
    });
  } else {
    memory.set(key, { reading, expires: Date.now() + TTL_SECONDS * 1000 });
  }
  return reading;
}

/** Tests only: forget in-memory readings. */
export function clearMemoryCache(): void {
  memory.clear();
}
