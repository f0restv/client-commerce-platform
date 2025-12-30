import Redis from 'ioredis';
import { createLogger } from './logger';

const log = createLogger({ service: 'redis' });

/**
 * Redis client with lazy initialization.
 * Only connects when first used.
 */
let redisClient: Redis | null = null;
let connectionAttempted = false;

/**
 * Get the Redis client.
 * Returns null if Redis is not configured or connection fails.
 * This allows the app to function without Redis (falls back to in-memory/file cache).
 */
export function getRedis(): Redis | null {
  if (connectionAttempted) {
    return redisClient;
  }

  connectionAttempted = true;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    log.info('REDIS_URL not configured, using fallback caching');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 500, 2000); // Exponential backoff
      },
    });

    redisClient.on('error', (err) => {
      log.error({ error: err }, 'Redis connection error');
    });

    redisClient.on('connect', () => {
      log.info('Redis connected');
    });

    redisClient.on('ready', () => {
      log.info('Redis ready');
    });

    return redisClient;
  } catch (error) {
    log.error({ error }, 'Failed to create Redis client');
    return null;
  }
}

/**
 * Check if Redis is available.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Cache interface that works with or without Redis.
 * Falls back to in-memory cache when Redis is unavailable.
 */
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Prefix for cache keys (e.g., 'market-data:') */
  prefix?: string;
}

const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Universal cache that uses Redis if available, falls back to memory.
 */
export const cache = {
  /**
   * Get a value from cache.
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const fullKey = options?.prefix ? `${options.prefix}${key}` : key;
    const redis = getRedis();

    if (redis) {
      try {
        const value = await redis.get(fullKey);
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      } catch (error) {
        log.warn({ error, key: fullKey }, 'Redis get failed, falling back to memory');
      }
    }

    // Fallback to memory cache
    const cached = memoryCache.get(fullKey);
    if (cached && cached.expiresAt > Date.now()) {
      return JSON.parse(cached.value) as T;
    }

    if (cached) {
      memoryCache.delete(fullKey);
    }

    return null;
  },

  /**
   * Set a value in cache.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = options?.prefix ? `${options.prefix}${key}` : key;
    const ttl = options?.ttl ?? DEFAULT_TTL;
    const serialized = JSON.stringify(value);
    const redis = getRedis();

    if (redis) {
      try {
        await redis.setex(fullKey, ttl, serialized);
        return;
      } catch (error) {
        log.warn({ error, key: fullKey }, 'Redis set failed, falling back to memory');
      }
    }

    // Fallback to memory cache
    memoryCache.set(fullKey, {
      value: serialized,
      expiresAt: Date.now() + ttl * 1000,
    });
  },

  /**
   * Delete a value from cache.
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    const fullKey = options?.prefix ? `${options.prefix}${key}` : key;
    const redis = getRedis();

    if (redis) {
      try {
        await redis.del(fullKey);
      } catch (error) {
        log.warn({ error, key: fullKey }, 'Redis delete failed');
      }
    }

    memoryCache.delete(fullKey);
  },

  /**
   * Get or set pattern - fetch from cache or compute and cache.
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, options);
    return value;
  },

  /**
   * Clear all cached items with a specific prefix.
   */
  async clearPrefix(prefix: string): Promise<number> {
    const redis = getRedis();
    let count = 0;

    if (redis) {
      try {
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          count = await redis.del(...keys);
        }
      } catch (error) {
        log.warn({ error, prefix }, 'Redis clearPrefix failed');
      }
    }

    // Also clear from memory cache
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
        count++;
      }
    }

    return count;
  },

  /**
   * Check cache health for monitoring.
   */
  async health(): Promise<{ type: 'redis' | 'memory'; available: boolean; size?: number }> {
    const redis = getRedis();

    if (redis) {
      try {
        await redis.ping();
        const dbSize = await redis.dbsize();
        return { type: 'redis', available: true, size: dbSize };
      } catch {
        return { type: 'redis', available: false };
      }
    }

    return {
      type: 'memory',
      available: true,
      size: memoryCache.size,
    };
  },
};

export default cache;
