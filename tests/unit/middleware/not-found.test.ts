import { describe, it, expect, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { notFoundHandler } from "../../../src/middleware/not-found.js";
import { AppError } from "../../../src/utils/app-error.js";

describe("Not Found Middleware", () => {
  it("should forward a 404 AppError with route details to next()", () => {
    const req = {
      method: "GET",
      originalUrl: "/api/unknown-endpoint",
    } as Request;
    const res = {} as Response;
    const next: NextFunction = jest.fn();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = (next as any).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(AppError);
    expect(errorArg.statusCode).toBe(404);
    expect(errorArg.message).toBe("Route not found: GET /api/unknown-endpoint");
  });
});
