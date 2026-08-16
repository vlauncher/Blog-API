import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";
import { requireRole } from "../../../src/middleware/authorize.js";
import { AppError } from "../../../src/utils/app-error.js";

describe("Authorize Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  it("should throw 401 if req.user is not set", () => {
    const middleware = requireRole("ADMIN");

    expect(() => {
      middleware(req as Request, res as Response, next);
    }).toThrow(AppError);

    try {
      middleware(req as Request, res as Response, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401);
    }
  });

  it("should throw 403 if user role is not permitted", () => {
    req.user = { id: "u1", email: "user@test.com", role: "READER" };
    const middleware = requireRole("AUTHOR", "ADMIN");

    try {
      middleware(req as Request, res as Response, next);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).message).toContain("permission");
    }
  });

  it("should call next() if user role is allowed", () => {
    req.user = { id: "u1", email: "admin@test.com", role: "ADMIN" };
    const middleware = requireRole("AUTHOR", "ADMIN");

    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
