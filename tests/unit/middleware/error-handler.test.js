import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { z } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { errorHandler } from "../../../src/middleware/error-handler.js";
import { AppError } from "../../../src/utils/app-error.js";
import { env } from "../../../src/config/env.js";
describe("Error Handler Middleware", () => {
    let req;
    let res;
    let next;
    let statusMock;
    let jsonMock;
    beforeEach(() => {
        req = {};
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = {
            status: statusMock,
        };
        next = jest.fn();
    });
    it("should handle operational AppError with correct status code", () => {
        const error = new AppError("Forbidden action", 403, true);
        errorHandler(error, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "fail",
            message: "Forbidden action",
        }));
    });
    it("should handle non-operational AppError (500)", () => {
        const error = new AppError("Database crash", 500, false);
        errorHandler(error, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "error",
            message: "Database crash",
        }));
    });
    it("should handle ZodError with 400 and validation error list", () => {
        const schema = z.object({ email: z.string().email() });
        let zodErr = null;
        try {
            schema.parse({ email: "invalid-email" });
        }
        catch (e) {
            zodErr = e;
        }
        errorHandler(zodErr, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "fail",
            message: "Validation failed",
            errors: expect.any(Array),
        }));
    });
    it("should handle Multer LIMIT_FILE_SIZE error", () => {
        const multerError = new multer.MulterError("LIMIT_FILE_SIZE");
        errorHandler(multerError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "fail",
            message: "File size exceeds limit (max 5MB)",
        });
    });
    it("should handle generic Multer error", () => {
        const multerError = new multer.MulterError("LIMIT_UNEXPECTED_FILE");
        errorHandler(multerError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "fail",
        }));
    });
    it("should handle Prisma P2002 unique constraint error with 409", () => {
        const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "6.0.0",
            meta: { target: ["email"] },
        });
        errorHandler(prismaError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "fail",
            message: "Unique constraint failed on email",
        });
    });
    it("should handle Prisma P2002 with non-array target", () => {
        const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "6.0.0",
        });
        errorHandler(prismaError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "fail",
            message: "Unique constraint failed on field",
        });
    });
    it("should handle Prisma P2025 not found error with 404", () => {
        const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
            code: "P2025",
            clientVersion: "6.0.0",
        });
        errorHandler(prismaError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "fail",
            message: "Record not found",
        });
    });
    it("should handle unhandled native errors with 500 in dev and prod", () => {
        const genericError = new Error("Something broke unexpectedly");
        errorHandler(genericError, req, res, next);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            status: "error",
        }));
        const originalEnv = env.NODE_ENV;
        env.NODE_ENV = "production";
        errorHandler("String error", req, res, next);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "error",
            message: "Internal server error",
        });
        env.NODE_ENV = originalEnv;
    });
});
//# sourceMappingURL=error-handler.test.js.map