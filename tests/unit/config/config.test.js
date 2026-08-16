import { describe, it, expect, jest } from "@jest/globals";
import { sendMail, transporter } from "../../../src/config/mailer.js";
import { uploadToCloudinary, deleteFromCloudinary, } from "../../../src/config/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../../src/config/env.js";
describe("Configuration & External Service Helpers", () => {
    describe("Mailer Helper", () => {
        it("should skip real email sending in test environment and return mock id", async () => {
            const result = await sendMail({
                to: "test@example.com",
                subject: "Hello",
                html: "<p>Hello World</p>",
            });
            expect(result).toEqual({ messageId: "test-id" });
        });
        it("should call transporter.sendMail in development environment", async () => {
            const originalEnv = env.NODE_ENV;
            env.NODE_ENV = "development";
            const sendMailSpy = jest
                .spyOn(transporter, "sendMail")
                .mockResolvedValueOnce({ messageId: "dev-msg-id" });
            const result = await sendMail({
                to: "dev@example.com",
                subject: "Dev Test",
                html: "<b>Dev</b>",
            });
            expect(sendMailSpy).toHaveBeenCalledTimes(1);
            expect(result.messageId).toBe("dev-msg-id");
            env.NODE_ENV = originalEnv;
            sendMailSpy.mockRestore();
        });
        it("should catch and throw error if mail transport fails in dev", async () => {
            const originalEnv = env.NODE_ENV;
            env.NODE_ENV = "development";
            const sendMailSpy = jest
                .spyOn(transporter, "sendMail")
                .mockRejectedValueOnce(new Error("SMTP connection failed"));
            await expect(sendMail({
                to: "dev@example.com",
                subject: "Fail",
                html: "<b>Fail</b>",
            })).rejects.toThrow("SMTP connection failed");
            env.NODE_ENV = originalEnv;
            sendMailSpy.mockRestore();
        });
    });
    describe("Cloudinary Helper", () => {
        it("should upload buffer via stream", async () => {
            const mockResult = {
                secure_url: "https://cloudinary.com/test.jpg",
                public_id: "test-id",
            };
            const uploadStreamSpy = jest
                .spyOn(cloudinary.uploader, "upload_stream")
                .mockImplementation((_opts, cb) => {
                cb(null, mockResult);
                return {};
            });
            const buffer = Buffer.from("test image stream");
            const res = await uploadToCloudinary(buffer, "custom/folder");
            expect(res).toEqual(mockResult);
            uploadStreamSpy.mockRestore();
        });
        it("should reject if upload stream returns an error", async () => {
            const uploadStreamSpy = jest
                .spyOn(cloudinary.uploader, "upload_stream")
                .mockImplementation((_opts, cb) => {
                cb(new Error("Upload failed"), null);
                return {};
            });
            const buffer = Buffer.from("test fail");
            await expect(uploadToCloudinary(buffer)).rejects.toThrow("Upload failed");
            uploadStreamSpy.mockRestore();
        });
        it("should call destroy to delete image", async () => {
            const destroySpy = jest
                .spyOn(cloudinary.uploader, "destroy")
                .mockResolvedValueOnce({ result: "ok" });
            await deleteFromCloudinary("public-id-123");
            expect(destroySpy).toHaveBeenCalledWith("public-id-123");
            destroySpy.mockRestore();
        });
        it("should handle destroy error gracefully without crashing", async () => {
            const destroySpy = jest
                .spyOn(cloudinary.uploader, "destroy")
                .mockRejectedValueOnce(new Error("Destroy error"));
            await expect(deleteFromCloudinary("public-id-fail")).resolves.not.toThrow();
            destroySpy.mockRestore();
        });
    });
});
//# sourceMappingURL=config.test.js.map