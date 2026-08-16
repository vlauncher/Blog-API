import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.warn({ err: err.message }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});
