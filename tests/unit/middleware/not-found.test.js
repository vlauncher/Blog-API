import { describe, it, expect, jest } from "@jest/globals";
import { notFoundHandler } from "../../../src/middleware/not-found.js";
import { AppError } from "../../../src/utils/app-error.js";
describe("Not Found Middleware", () => {
    it("should forward a 404 AppError with route details to next()", () => {
        const req = {
            method: "GET",
            originalUrl: "/api/unknown-endpoint",
        };
        const res = {};
        const next = jest.fn();
        notFoundHandler(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        const errorArg = next.mock.calls[0][0];
        expect(errorArg).toBeInstanceOf(AppError);
        expect(errorArg.statusCode).toBe(404);
        expect(errorArg.message).toBe("Route not found: GET /api/unknown-endpoint");
    });
});
//# sourceMappingURL=not-found.test.js.map