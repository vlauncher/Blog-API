import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";

const createLimiter = (options: { windowMs: number; limit: number; message: string }) => {
  if (env.NODE_ENV === "test") {
    // Return pass-through middleware in test environment
    return (_req: any, _res: any, next: any) => next();
  }

  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      status: "fail",
      message: options.message,
    },
    store: new RedisStore({
      sendCommand: async (...args: string[]) => {
        return (await (redis as any).call(args[0], ...args.slice(1))) as any;
      },
      prefix: "rl:",
    }),
  });
};

export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per 15 min
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 requests per 15 min for sensitive auth endpoints
  message: "Too many authentication attempts, please try again after 15 minutes.",
});

export const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60, // 60 write requests per 15 min
  message: "Too many write requests, please slow down.",
});
