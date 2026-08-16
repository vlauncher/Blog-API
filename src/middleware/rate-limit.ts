import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";

const createLimiter = (options: {
  windowMs: number;
  limit: number;
  message: string;
  keyByUser?: boolean;
}) => {
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
    keyGenerator: (req: any) => {
      if (options.keyByUser && req.user?.id) {
        return `user:${req.user.id}`;
      }
      return req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
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
  limit: 1000, // 1000 requests per 15 min
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50, // 50 requests per 15 min for sensitive auth endpoints
  message: "Too many authentication attempts, please try again after 15 minutes.",
});

export const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300, // 300 write requests per 15 min per user/IP
  keyByUser: true,
  message: "Too many write requests, please slow down.",
});
