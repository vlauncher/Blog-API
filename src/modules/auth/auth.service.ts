import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { sendMail } from "../../config/mailer.js";
import { AppError } from "../../utils/app-error.js";
import {
  generateOtp,
  storeOtp,
  verifyOtp,
  checkResendRateLimit,
} from "../../utils/otp.js";
import type {
  RegisterInput,
  VerifyEmailInput,
  ResendOtpInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.schema.js";

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
  tokenId?: string;
}

export class AuthService {
  private generateTokens(userId: string, email: string, role = "READER") {
    const tokenId = crypto.randomUUID();

    const accessToken = jwt.sign(
      { userId, email, role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    const refreshToken = jwt.sign(
      { userId, email, role, tokenId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    return { accessToken, refreshToken, tokenId };
  }

  async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        password: hashedPassword,
        isVerified: false,
        profile: {
          create: {},
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
        createdAt: true,
      },
    });

    const otp = generateOtp();
    await storeOtp("verify", user.email, otp);

    await sendMail({
      to: user.email,
      subject: "Verify Your Email - Blog API",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Welcome to Blog API, ${user.firstName}!</h2>
          <p>Thank you for registering. Please use the following 6-digit One-Time Password (OTP) to verify your email address:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes. If you did not create this account, please ignore this email.</p>
        </div>
      `,
    });

    return {
      message: "Registration successful. Please verify your email with the OTP sent to your inbox.",
      user,
    };
  }

  async verifyEmail(input: VerifyEmailInput) {
    const email = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isVerified) {
      return { message: "Email is already verified. You can log in." };
    }

    const isValid = await verifyOtp("verify", email, input.otp);
    if (!isValid) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    return {
      message: "Email successfully verified. You can now log in.",
    };
  }

  async resendOtp(input: ResendOtpInput) {
    const email = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isVerified) {
      throw new AppError("Email is already verified", 400);
    }

    const rateLimit = await checkResendRateLimit(email);
    if (!rateLimit.allowed) {
      throw new AppError("Maximum resend attempts reached. Please wait an hour before trying again.", 429);
    }

    const otp = generateOtp();
    await storeOtp("verify", email, otp);

    await sendMail({
      to: email,
      subject: "New Verification OTP - Blog API",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Email Verification OTP</h2>
          <p>Here is your new One-Time Password (OTP):</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for 10 minutes. (${rateLimit.remaining} resend attempts remaining this hour)</p>
        </div>
      `,
    });

    return {
      message: "Verification OTP resent successfully.",
      remainingAttempts: rateLimit.remaining,
    };
  }

  async login(input: LoginInput) {
    const email = input.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401);
    }

    if (!user.isVerified) {
      throw new AppError("Please verify your email address before logging in", 403);
    }

    const { accessToken, refreshToken, tokenId } = this.generateTokens(user.id, user.email, user.role);

    // Save active refresh token in Redis
    await redis.set(`refresh:${user.id}:${tokenId}`, "true", "EX", REFRESH_TOKEN_TTL_SECONDS);

    return {
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshTokenStr: string) {
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(refreshTokenStr, env.JWT_REFRESH_SECRET) as TokenPayload;
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const { userId, email, role, tokenId } = decoded;

    if (!tokenId) {
      throw new AppError("Malformed refresh token", 401);
    }

    const redisKey = `refresh:${userId}:${tokenId}`;
    const exists = await redis.get(redisKey);

    if (!exists) {
      throw new AppError("Refresh token has been revoked or expired", 401);
    }

    // Invalidate old token
    await redis.del(redisKey);

    // Issue new pair
    const tokens = this.generateTokens(userId, email, role || "READER");
    await redis.set(`refresh:${userId}:${tokens.tokenId}`, "true", "EX", REFRESH_TOKEN_TTL_SECONDS);

    return {
      message: "Tokens refreshed successfully",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, refreshTokenStr?: string) {
    if (refreshTokenStr) {
      try {
        const decoded = jwt.decode(refreshTokenStr) as TokenPayload | null;
        if (decoded?.tokenId) {
          await redis.del(`refresh:${userId}:${decoded.tokenId}`);
        }
      } catch {
        // Continue to general revocation if single token decode fails
      }
    }

    // Invalidate all active refresh tokens for this user
    const keys = await redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return { message: "Logged out successfully" };
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const otp = generateOtp();
      await storeOtp("reset", email, otp);

      await sendMail({
        to: email,
        subject: "Password Reset OTP - Blog API",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Use the 6-digit OTP below to complete the reset:</p>
            <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${otp}
            </div>
            <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });
    }

    return {
      message: "If an account with this email exists, a password reset OTP has been sent.",
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError("Invalid email or reset request", 400);
    }

    const isValid = await verifyOtp("reset", email, input.otp);
    if (!isValid) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // Invalidate all existing sessions
    const keys = await redis.keys(`refresh:${user.id}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return {
      message: "Password reset successful. You can now log in with your new password.",
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.password);
    if (!isMatch) {
      throw new AppError("Incorrect current password", 400);
    }

    const hashedPassword = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      message: "Password changed successfully.",
    };
  }
}

export const authService = new AuthService();
