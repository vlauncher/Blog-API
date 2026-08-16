import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

const app = createApp();

describe("Auth Integration Tests", () => {
  const testUser = {
    firstName: "Alice",
    lastName: "Smith",
    email: "alice.smith@example.com",
    password: "Password123",
  };

  describe("POST /api/auth/register", () => {
    it("should fail validation if password has no uppercase or number", async () => {
      const res = await request(app).post("/api/auth/register").send({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@example.com",
        password: "weakpassword",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
      expect(res.body.errors).toBeDefined();
    });

    it("should register a user, create profile, and store verify OTP in Redis", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.user).toMatchObject({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@example.com",
        isVerified: false,
      });

      // Verify OTP stored in Redis
      const storedOtp = await redis.get(`otp:verify:${testUser.email.toLowerCase()}`);
      expect(storedOtp).toBeDefined();
      expect(storedOtp).toHaveLength(6);
    });

    it("should return 409 if email already registered", async () => {
      const res = await request(app).post("/api/auth/register").send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.status).toBe("fail");
      expect(res.body.message).toContain("already exists");
    });
  });

  describe("POST /api/auth/verify-email", () => {
    it("should fail with 404 for non-existent user", async () => {
      const res = await request(app).post("/api/auth/verify-email").send({
        email: "ghost@example.com",
        otp: "123456",
      });

      expect(res.status).toBe(404);
    });

    it("should fail with 400 for incorrect OTP", async () => {
      const res = await request(app).post("/api/auth/verify-email").send({
        email: testUser.email,
        otp: "999999",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Invalid or expired OTP");
    });

    it("should verify email with valid OTP", async () => {
      const storedOtp = await redis.get(`otp:verify:${testUser.email.toLowerCase()}`);
      expect(storedOtp).toBeDefined();

      const res = await request(app).post("/api/auth/verify-email").send({
        email: testUser.email,
        otp: storedOtp!,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("successfully verified");

      // Verify DB updated
      const updatedUser = await prisma.user.findUnique({
        where: { email: testUser.email.toLowerCase() },
      });
      expect(updatedUser?.isVerified).toBe(true);
    });

    it("should return friendly message if already verified", async () => {
      const res = await request(app).post("/api/auth/verify-email").send({
        email: testUser.email,
        otp: "123456",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("already verified");
    });
  });

  describe("POST /api/auth/resend-otp", () => {
    const unverifiedUser = {
      firstName: "Bob",
      lastName: "Jones",
      email: "bob.jones@example.com",
      password: "Password123",
    };

    beforeAll(async () => {
      await request(app).post("/api/auth/register").send(unverifiedUser);
    });

    it("should return 404 for unknown user", async () => {
      const res = await request(app).post("/api/auth/resend-otp").send({
        email: "unknown@example.com",
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 if user is already verified", async () => {
      const res = await request(app).post("/api/auth/resend-otp").send({
        email: testUser.email,
      });
      expect(res.status).toBe(400);
    });

    it("should resend OTP and enforce rate limit after 3 attempts", async () => {
      // 1st resend
      const res1 = await request(app).post("/api/auth/resend-otp").send({
        email: unverifiedUser.email,
      });
      expect(res1.status).toBe(200);
      expect(res1.body.remainingAttempts).toBe(2);

      // 2nd resend
      const res2 = await request(app).post("/api/auth/resend-otp").send({
        email: unverifiedUser.email,
      });
      expect(res2.status).toBe(200);
      expect(res2.body.remainingAttempts).toBe(1);

      // 3rd resend
      const res3 = await request(app).post("/api/auth/resend-otp").send({
        email: unverifiedUser.email,
      });
      expect(res3.status).toBe(200);
      expect(res3.body.remainingAttempts).toBe(0);

      // 4th attempt -> 429
      const res4 = await request(app).post("/api/auth/resend-otp").send({
        email: unverifiedUser.email,
      });
      expect(res4.status).toBe(429);
      expect(res4.body.message).toContain("Maximum resend attempts reached");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should fail with 401 on non-existent email", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nobody@example.com",
        password: "Password123",
      });
      expect(res.status).toBe(401);
    });

    it("should fail with 401 on incorrect password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "WrongPassword123",
      });
      expect(res.status).toBe(401);
    });

    it("should fail with 403 if user is unverified", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "bob.jones@example.com",
        password: "Password123",
      });
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("verify your email");
    });

    it("should succeed with 200 and return access + refresh tokens", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user).toMatchObject({
        email: testUser.email,
        firstName: "Alice",
      });
    });
  });

  describe("POST /api/auth/refresh-token", () => {
    let refreshToken: string;

    beforeAll(async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });
      refreshToken = loginRes.body.refreshToken;
    });

    it("should fail with 401 on invalid refresh token", async () => {
      const res = await request(app).post("/api/auth/refresh-token").send({
        refreshToken: "invalid.token.here",
      });
      expect(res.status).toBe(401);
    });

    it("should succeed with new token pair using valid refresh token", async () => {
      const res = await request(app).post("/api/auth/refresh-token").send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // Old refresh token should now be revoked
      const retryOld = await request(app).post("/api/auth/refresh-token").send({
        refreshToken,
      });
      expect(retryOld.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginRes.body.accessToken;
      refreshToken = loginRes.body.refreshToken;
    });

    it("should fail with 401 without auth header", async () => {
      const res = await request(app).post("/api/auth/logout").send();
      expect(res.status).toBe(401);
    });

    it("should revoke refresh tokens on logout", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);

      // Refresh token should now be invalid
      const refreshRes = await request(app).post("/api/auth/refresh-token").send({
        refreshToken,
      });
      expect(refreshRes.status).toBe(401);
    });
  });

  describe("Forgot & Reset Password Flow", () => {
    it("should handle forgot-password for non-existent email gracefully", async () => {
      const res = await request(app).post("/api/auth/forgot-password").send({
        email: "ghost@example.com",
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an account with this email exists");
    });

    it("should generate reset OTP for existing email", async () => {
      const res = await request(app).post("/api/auth/forgot-password").send({
        email: testUser.email,
      });
      expect(res.status).toBe(200);

      const resetOtp = await redis.get(`otp:reset:${testUser.email.toLowerCase()}`);
      expect(resetOtp).toBeDefined();
      expect(resetOtp).toHaveLength(6);
    });

    it("should fail reset-password with invalid OTP", async () => {
      const res = await request(app).post("/api/auth/reset-password").send({
        email: testUser.email,
        otp: "000000",
        newPassword: "BrandNewPassword123",
      });
      expect(res.status).toBe(400);
    });

    it("should succeed reset-password with valid OTP", async () => {
      const resetOtp = await redis.get(`otp:reset:${testUser.email.toLowerCase()}`);

      const res = await request(app).post("/api/auth/reset-password").send({
        email: testUser.email,
        otp: resetOtp!,
        newPassword: "BrandNewPassword123",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Password reset successful");

      // Verify login works with new password
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "BrandNewPassword123",
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe("POST /api/auth/change-password", () => {
    let accessToken: string;

    beforeEach(async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "BrandNewPassword123",
      });
      accessToken = loginRes.body.accessToken;
    });

    it("should fail with 400 on incorrect current password", async () => {
      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "WrongCurrentPassword123",
          newPassword: "AnotherNewPassword456",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Incorrect current password");
    });

    it("should succeed and update password with correct current password", async () => {
      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "BrandNewPassword123",
          newPassword: "AnotherNewPassword456",
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Password changed successfully");

      // Verify login works with newest password
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "AnotherNewPassword456",
      });
      expect(loginRes.status).toBe(200);
    });
  });
});
