import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../../../src/middleware/auth.js";
import { env } from "../../../src/config/env.js";
import { AppError } from "../../../src/utils/app-error.js";

describe("Auth Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {};
    next = jest.fn();
  });

  it("should throw 401 AppError if authorization header is missing", () => {
    expect(() => {
      authenticate(req as Request, res as Response, next);
    }).toThrow(AppError);

    try {
      authenticate(req as Request, res as Response, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).message).toContain("Authentication required");
    }
  });

  it("should throw 401 AppError if authorization header does not start with Bearer", () => {
    req.headers = { authorization: "Basic 123456" };

    expect(() => {
      authenticate(req as Request, res as Response, next);
    }).toThrow(AppError);
  });

  it("should attach user to req and call next() on valid token", () => {
    const payload = { userId: "user-123", email: "user@example.com" };
    const token = jwt.sign(payload, env.JWT_ACCESS_SECRET);
    req.headers = { authorization: `Bearer ${token}` };

    authenticate(req as Request, res as Response, next);

    expect(req.user).toEqual({
      id: "user-123",
      email: "user@example.com",
      role: "READER",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should throw 401 AppError if token is expired", () => {
    const payload = { userId: "user-123", email: "user@example.com" };
    const expiredToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "0s" });
    req.headers = { authorization: `Bearer ${expiredToken}` };

    try {
      authenticate(req as Request, res as Response, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).message).toContain("Token expired");
    }
  });

  it("should throw 401 AppError on invalid token signature", () => {
    req.headers = { authorization: "Bearer invalid.signature.token" };

    try {
      authenticate(req as Request, res as Response, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).message).toContain("Invalid authentication token");
    }
  });
});
