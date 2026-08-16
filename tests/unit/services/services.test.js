import { describe, it, expect } from "@jest/globals";
import jwt from "jsonwebtoken";
import { authService } from "../../../src/modules/auth/auth.service.js";
import { profileService } from "../../../src/modules/profile/profile.service.js";
import { env } from "../../../src/config/env.js";
describe("Service Edge Case Unit Tests", () => {
    describe("AuthService Edge Cases", () => {
        it("should throw 401 when refresh token lacks tokenId", async () => {
            const malformedToken = jwt.sign({ userId: "user-1", email: "user@example.com" }, // no tokenId
            env.JWT_REFRESH_SECRET);
            await expect(authService.refreshToken(malformedToken)).rejects.toThrow("Malformed refresh token");
        });
        it("should throw 400 when resetPassword is called with non-existent email", async () => {
            await expect(authService.resetPassword({
                email: "ghost@example.com",
                otp: "123456",
                newPassword: "NewPassword123",
            })).rejects.toThrow("Invalid email or reset request");
        });
        it("should throw 404 when changePassword is called with non-existent userId", async () => {
            await expect(authService.changePassword("ghost-user-id", {
                currentPassword: "OldPassword123",
                newPassword: "NewPassword123",
            })).rejects.toThrow("User not found");
        });
    });
    describe("ProfileService Edge Cases", () => {
        it("should throw 404 when getProfile is called with non-existent userId", async () => {
            await expect(profileService.getProfile("ghost-user-id")).rejects.toThrow("User not found");
        });
    });
});
//# sourceMappingURL=services.test.js.map