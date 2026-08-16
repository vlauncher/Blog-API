import { describe, it, expect } from "@jest/globals";
import { AppError } from "../../../src/utils/app-error.js";
describe("AppError", () => {
    it("should initialize with default statusCode 500 and isOperational true", () => {
        const error = new AppError("Something went wrong");
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe("Something went wrong");
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
        expect(error.stack).toBeDefined();
    });
    it("should initialize with custom statusCode and isOperational", () => {
        const error = new AppError("Resource not found", 404, false);
        expect(error.message).toBe("Resource not found");
        expect(error.statusCode).toBe(404);
        expect(error.isOperational).toBe(false);
    });
});
//# sourceMappingURL=app-error.test.js.map