import { describe, it, expect, jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { uploadProfileImage } from "../../../src/middleware/upload.js";
import { errorHandler } from "../../../src/middleware/error-handler.js";

describe("Upload Middleware", () => {
  const app = express();
  app.post(
    "/test-upload",
    uploadProfileImage,
    (req, res) => {
      res.status(200).json({ status: "success", file: req.file?.originalname });
    },
    errorHandler
  );

  it("should accept valid jpeg, png, webp, gif images", async () => {
    const res = await request(app)
      .post("/test-upload")
      .attach("picture", Buffer.from("fake-jpeg-data"), {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.file).toBe("test.jpg");
  });

  it("should reject invalid file types with 400 AppError", async () => {
    const res = await request(app)
      .post("/test-upload")
      .attach("picture", Buffer.from("fake-pdf-data"), {
        filename: "doc.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Only JPEG, PNG, WEBP, and GIF");
  });
});
