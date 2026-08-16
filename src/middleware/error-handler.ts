import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Operational App Errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err }, "Non-operational AppError encountered");
    } else {
      logger.warn({ statusCode: err.statusCode, message: err.message }, "Operational error handled");
    }

    res.status(err.statusCode).json({
      status: err.statusCode >= 500 ? "error" : "fail",
      message: err.message,
      ...(env.NODE_ENV === "development" && { stack: err.stack }),
    });
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    res.status(400).json({
      status: "fail",
      message: "Validation failed",
      errors: formattedErrors,
    });
    return;
  }

  // 3. Multer Errors
  if (err instanceof multer.MulterError) {
    let message = err.message;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds limit (max 5MB)";
    }

    res.status(400).json({
      status: "fail",
      message,
    });
    return;
  }

  // 4. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "field";
      res.status(409).json({
        status: "fail",
        message: `Unique constraint failed on ${target}`,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        status: "fail",
        message: "Record not found",
      });
      return;
    }
  }

  // 5. Unhandled / Server Errors
  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error({ err: errorObj }, "Unhandled server error occurred");

  res.status(500).json({
    status: "error",
    message: env.NODE_ENV === "production" ? "Internal server error" : errorObj.message,
    ...(env.NODE_ENV === "development" && { stack: errorObj.stack }),
  });
};
