import crypto from "node:crypto";
import { redis } from "../config/redis.js";

export const OTP_TTL_SECONDS = 600; // 10 minutes
export const RATE_LIMIT_TTL_SECONDS = 3600; // 1 hour
export const MAX_RESENDS_PER_HOUR = 3;

export const generateOtp = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

export const storeOtp = async (
  prefix: "verify" | "reset",
  email: string,
  otp: string
): Promise<void> => {
  const key = `otp:${prefix}:${email.toLowerCase()}`;
  await redis.set(key, otp, "EX", OTP_TTL_SECONDS);
};

export const verifyOtp = async (
  prefix: "verify" | "reset",
  email: string,
  otp: string
): Promise<boolean> => {
  const key = `otp:${prefix}:${email.toLowerCase()}`;
  const storedOtp = await redis.get(key);

  if (!storedOtp) {
    return false;
  }

  if (storedOtp === otp) {
    await redis.del(key);
    return true;
  }

  return false;
};

export const checkResendRateLimit = async (
  email: string
): Promise<{ allowed: boolean; remaining: number }> => {
  const key = `otp:rate-limit:${email.toLowerCase()}`;
  const current = await redis.get(key);

  if (current && parseInt(current, 10) >= MAX_RESENDS_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_LIMIT_TTL_SECONDS);
  }

  return {
    allowed: true,
    remaining: Math.max(0, MAX_RESENDS_PER_HOUR - count),
  };
};
