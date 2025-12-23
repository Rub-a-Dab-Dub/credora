import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cluster } from 'ioredis';

@Injectable()
export class CacheService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Implements the cache-aside pattern.
   * @param key The cache key.
   * @param fallback A function to fetch the data if it's not in the cache.
   * @param ttl Time-to-live in seconds.
   * @returns The cached or freshly fetched data.
   */
  async getOrSet<T>(key: string, fallback: () => Promise<T>, ttl: number): Promise<T> {
    const cachedData = await this.redis.get(key);

    if (cachedData) {
      return JSON.parse(cachedData) as T;
    }

    const freshData = await fallback();
    await this.redis.set(key, JSON.stringify(freshData), 'EX', ttl);
    return freshData;
  }

  /**
   * Invalidates a cache entry.
   * @param key The cache key to delete.
   */
  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
