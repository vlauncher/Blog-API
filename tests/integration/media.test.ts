import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import sharp from "sharp";

const app = createApp();

describe("Media Integration Tests", () => {
  let authorToken: string;
  let mockUploadStream: any;
  let mockDestroy: any;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.user.deleteMany();

    const author = await prisma.user.create({
      data: {
        firstName: "Artist",
        lastName: "User",
        email: "artist@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    authorToken = jwt.sign({ userId: author.id, email: author.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);

    mockUploadStream = jest
      .spyOn(cloudinary.uploader, "upload_stream")
      .mockImplementation((_opts: any, cb: any) => {
        cb(null, {
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1/blog/posts/sample.webp",
          public_id: "blog/posts/sample123",
          format: "webp",
          bytes: 12345,
          width: 800,
          height: 600,
        });
        return {} as any;
      });

    mockDestroy = jest
      .spyOn(cloudinary.uploader, "destroy")
      .mockImplementation((_publicId: any) => {
        return Promise.resolve({ result: "ok" }) as any;
      });
  });

  afterEach(() => {
    mockUploadStream.mockRestore();
    mockDestroy.mockRestore();
  });

  it("POST /api/media/upload - should optimize image via Sharp and upload to Cloudinary", async () => {
    const testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post("/api/media/upload")
      .set("Authorization", `Bearer ${authorToken}`)
      .attach("picture", testImageBuffer, "test-cover.png")
      .field("folder", "blog/posts");

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.url).toBeDefined();
    expect(res.body.data.publicId).toBeDefined();
  });

  it("DELETE /api/media/:publicId - should delete asset from Cloudinary", async () => {
    const res = await request(app)
      .delete("/api/media/blog/posts/sample-id")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});
