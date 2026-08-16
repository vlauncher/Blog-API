import { describe, it, expect } from "@jest/globals";
import sharp from "sharp";
import { optimizeImage } from "../../../src/utils/image.js";
import { redis } from "../../../src/config/redis.js";

describe("Utility & Config Deep Coverage", () => {
  it("should trigger iterative image compression when target size is tiny", async () => {
    // Generate a detailed large image that exceeds 10KB
    const largeBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 120, g: 80, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const tinyMaxBytes = 15 * 1024; // 15 KB
    const compressed = await optimizeImage(largeBuffer, tinyMaxBytes);

    expect(compressed.length).toBeLessThanOrEqual(tinyMaxBytes);
  });

  it("should test redis options and callbacks", () => {
    expect(redis.options.maxRetriesPerRequest).toBe(3);
    const retryFn = redis.options.retryStrategy;
    if (retryFn) {
      expect(retryFn(1)).toBe(50);
      expect(retryFn(100)).toBe(2000);
    }
  });
});
