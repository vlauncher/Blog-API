import { describe, it, expect, beforeEach } from "@jest/globals";
import { CacheService } from "../../../src/services/cache.service.js";
import { redis } from "../../../src/config/redis.js";

describe("CacheService Unit Tests", () => {
  beforeEach(async () => {
    await redis.flushall();
  });

  it("should get and set cache values with TTL", async () => {
    const data = { title: "Post 1", count: 42 };
    await CacheService.set("test:key", data, 60);

    const cached = await CacheService.get("test:key");
    expect(cached).toEqual(data);
  });

  it("should return null for non-existent cache key", async () => {
    const cached = await CacheService.get("nonexistent:key");
    expect(cached).toBeNull();
  });

  it("should delete keys from cache", async () => {
    await CacheService.set("k1", "v1");
    await CacheService.set("k2", "v2");

    await CacheService.del("k1", "k2");

    expect(await CacheService.get("k1")).toBeNull();
    expect(await CacheService.get("k2")).toBeNull();
  });

  it("should get and increment version", async () => {
    const v1 = await CacheService.getVersion("posts");
    expect(v1).toBe(1);

    const v2 = await CacheService.incrementVersion("posts");
    expect(v2).toBe(1);

    const v3 = await CacheService.incrementVersion("posts");
    expect(v3).toBe(2);
  });

  it("should invalidate post and taxonomy caches", async () => {
    await CacheService.set("blog:post:slug:test", "val");
    await CacheService.set("blog:feed:rss", "xml");

    await CacheService.invalidatePostCaches("test", "id123");

    expect(await CacheService.get("blog:post:slug:test")).toBeNull();
    expect(await CacheService.get("blog:feed:rss")).toBeNull();

    await CacheService.set("blog:categories:tree", "tree");
    await CacheService.invalidateTaxonomy();
    expect(await CacheService.get("blog:categories:tree")).toBeNull();
  });
});
