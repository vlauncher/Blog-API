import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import { authenticate } from "../../../src/middleware/auth.js";
import { env } from "../../../src/config/env.js";
import { AppError } from "../../../src/utils/app-error.js";
describe("Auth Middleware", () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = {
            headers: {},
        };
        res = {};
        next = jest.fn();
    });
    it("should throw 401 AppError if authorization header is missing", () => {
        expect(() => {
            authenticate(req, res, next);
        }).toThrow(AppError);
        try {
            authenticate(req, res, next);
        }
        catch (err) {
            expect(err.statusCode).toBe(401);
            expect(err.message).toContain("Authentication required");
        }
    });
    it("should throw 401 AppError if authorization header does not start with Bearer", () => {
        req.headers = { authorization: "Basic 123456" };
        expect(() => {
            authenticate(req, res, next);
        }).toThrow(AppError);
    });
    it("should attach user to req and call next() on valid token", () => {
        const payload = { userId: "user-123", email: "user@example.com" };
        const token = jwt.sign(payload, env.JWT_ACCESS_SECRET);
        req.headers = { authorization: `Bearer ${token}` };
        authenticate(req, res, next);
        expect(req.user).toEqual({
            id: "user-123",
            email: "user@example.com",
        });
        expect(next).toHaveBeenCalledTimes(1);
    });
    it("should throw 401 AppError if token is expired", () => {
        const payload = { userId: "user-123", email: "user@example.com" };
        const expiredToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: "0s" });
        req.headers = { authorization: `Bearer ${expiredToken}` };
        try {
            authenticate(req, res, next);
        }
        catch (err) {
            expect(err.statusCode).toBe(401);
            expect(err.message).toContain("Token expired");
        }
    });
    it("should throw 401 AppError on invalid token signature", () => {
        req.headers = { authorization: "Bearer invalid.signature.token" };
        try {
            authenticate(req, res, next);
        }
        catch (err) {
            expect(err.statusCode).toBe(401);
            expect(err.message).toContain("Invalid authentication token");
        }
    });
});
//# sourceMappingURL=auth.test.js.map