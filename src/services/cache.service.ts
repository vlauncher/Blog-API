import { redis } from "../config/redis.js";
import { logger } from "../utils/logger.js";

export class CacheService {
  private static DEFAULT_TTL = 3600; // 1 hour

  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      logger.warn({ err, key }, "Cache GET error (failing open)");
      return null;
    }
  }

  static async set(key: string, data: unknown, ttlSeconds = this.DEFAULT_TTL): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      await redis.set(key, serialized, "EX", ttlSeconds);
    } catch (err) {
      logger.warn({ err, key }, "Cache SET error");
    }
  }

  static async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      logger.warn({ err, keys }, "Cache DEL error");
    }
  }

  static async getVersion(namespace: string): Promise<number> {
    try {
      const ver = await redis.get(`cache:ver:${namespace}`);
      return ver ? parseInt(ver, 10) : 1;
    } catch {
      return 1;
    }
  }

  static async incrementVersion(namespace: string): Promise<number> {
    try {
      return await redis.incr(`cache:ver:${namespace}`);
    } catch {
      return 1;
    }
  }

  static async invalidatePostCaches(slug?: string, id?: string): Promise<void> {
    const keysToDelete: string[] = ["blog:feed:rss", "blog:feed:json", "blog:sitemap"];
    if (slug) keysToDelete.push(`blog:post:slug:${slug}`);
    if (id) keysToDelete.push(`blog:post:id:${id}`);

    await this.del(...keysToDelete);
    await this.incrementVersion("posts");
  }

  static async invalidateTaxonomy(): Promise<void> {
    await this.del("blog:categories:tree", "blog:tags:list", "blog:sitemap");
    await this.incrementVersion("posts");
  }
}
