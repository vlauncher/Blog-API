import { describe, it, expect, afterEach } from "@jest/globals";
import {
  generateOtp,
  storeOtp,
  verifyOtp,
  checkResendRateLimit,
  MAX_RESENDS_PER_HOUR,
} from "../../../src/utils/otp.js";
import { redis } from "../../../src/config/redis.js";

describe("OTP Utilities", () => {
  const testEmail = "test.otp@example.com";

  afterEach(async () => {
    try {
      const keys = await redis.keys("otp:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Ignore
    }
  });

  describe("generateOtp", () => {
    it("should generate a 6-digit numeric string", () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });
  });

  describe("storeOtp & verifyOtp", () => {
    it("should store and verify valid OTP, deleting it afterwards", async () => {
      const otp = "123456";
      await storeOtp("verify", testEmail, otp);

      const isValid = await verifyOtp("verify", testEmail, otp);
      expect(isValid).toBe(true);

      // Verify second attempt returns false since it was deleted
      const isSecondAttemptValid = await verifyOtp("verify", testEmail, otp);
      expect(isSecondAttemptValid).toBe(false);
    });

    it("should return false if OTP does not match", async () => {
      await storeOtp("verify", testEmail, "123456");
      const isValid = await verifyOtp("verify", testEmail, "654321");
      expect(isValid).toBe(false);
    });

    it("should return false if OTP is not in redis", async () => {
      const isValid = await verifyOtp("verify", "nonexistent@example.com", "123456");
      expect(isValid).toBe(false);
    });
  });

  describe("checkResendRateLimit", () => {
    it("should allow up to MAX_RESENDS_PER_HOUR requests and then block", async () => {
      for (let i = 1; i <= MAX_RESENDS_PER_HOUR; i++) {
        const result = await checkResendRateLimit(testEmail);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(MAX_RESENDS_PER_HOUR - i);
      }

      // Next request should be blocked
      const blocked = await checkResendRateLimit(testEmail);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });
});
