import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("Profile Integration Tests", () => {
  let accessToken: string;
  let userId: string;

  const testUser = {
    firstName: "Charlie",
    lastName: "Brown",
    email: "charlie.brown@example.com",
    password: "Password123",
  };

  beforeAll(async () => {
    // 1. Register
    const regRes = await request(app).post("/api/auth/register").send(testUser);
    userId = regRes.body.user.id;

    // 2. Fetch OTP and verify
    const { redis } = await import("../../src/config/redis.js");
    const otp = await redis.get(`otp:verify:${testUser.email.toLowerCase()}`);
    await request(app).post("/api/auth/verify-email").send({
      email: testUser.email,
      otp: otp!,
    });

    // 3. Login
    const loginRes = await request(app).post("/api/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });
    accessToken = loginRes.body.accessToken;
  });

  describe("GET /api/profile", () => {
    it("should return 401 without auth token", async () => {
      const res = await request(app).get("/api/profile");
      expect(res.status).toBe(401);
    });

    it("should return profile of authenticated user", async () => {
      const res = await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data).toMatchObject({
        firstName: "Charlie",
        lastName: "Brown",
        email: "charlie.brown@example.com",
        profile: expect.any(Object),
      });
    });
  });

  describe("PATCH /api/profile", () => {
    it("should fail validation if age is under 13", async () => {
      const res = await request(app)
        .patch("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ age: 10 });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
    });

    it("should update age, bio, phoneNumber, and address successfully", async () => {
      const res = await request(app)
        .patch("/api/profile")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          age: 29,
          bio: "Senior software engineer",
          phoneNumber: "+1987654321",
          address: "456 Code Way",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        age: 29,
        bio: "Senior software engineer",
        phoneNumber: "+1987654321",
        address: "456 Code Way",
      });
    });
  });

  describe("Profile Picture Upload & Deletion", () => {
    let mockUploadStream: any;
    let mockDestroy: any;

    beforeEach(() => {
      mockUploadStream = jest
        .spyOn(cloudinary.uploader, "upload_stream")
        .mockImplementation((_opts: any, cb: any) => {
          cb(null, {
            secure_url: "https://res.cloudinary.com/demo/image/upload/v1/blog/profiles/sample.webp",
            public_id: "blog/profiles/sample123",
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

    it("should return 400 when no picture file is provided", async () => {
      const res = await request(app)
        .patch("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Please provide an image file");
    });

    it("should return 400 when invalid file format is uploaded", async () => {
      const res = await request(app)
        .patch("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("picture", Buffer.from("not an image"), "test.txt");

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("Only JPEG, PNG, WEBP, and GIF images are allowed");
    });

    it("should upload image, optimize via Sharp, and update profile", async () => {
      const testImageBuffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 4,
          background: { r: 100, g: 200, b: 100, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const res = await request(app)
        .patch("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("picture", testImageBuffer, "avatar.png");

      expect(res.status).toBe(200);
      expect(mockUploadStream).toHaveBeenCalledTimes(1);
      expect(res.body.data.profilePicture).toBe(
        "https://res.cloudinary.com/demo/image/upload/v1/blog/profiles/sample.webp"
      );
    });

    it("should delete old image on Cloudinary when updating profile picture again", async () => {
      mockUploadStream.mockImplementationOnce((_opts: any, cb: any) => {
        cb(null, {
          secure_url: "https://res.cloudinary.com/demo/image/upload/v2/blog/profiles/new_sample.webp",
          public_id: "blog/profiles/new_sample456",
        });
        return {} as any;
      });

      const testImageBuffer = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 200, g: 100, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const res = await request(app)
        .patch("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`)
        .attach("picture", testImageBuffer, "new_avatar.png");

      expect(res.status).toBe(200);
      expect(mockDestroy).toHaveBeenCalledWith("blog/profiles/sample123");
      expect(res.body.data.profilePicture).toBe(
        "https://res.cloudinary.com/demo/image/upload/v2/blog/profiles/new_sample.webp"
      );
    });

    it("should delete profile picture and remove from database", async () => {
      const res = await request(app)
        .delete("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(mockDestroy).toHaveBeenCalledWith("blog/profiles/new_sample456");
      expect(res.body.data.profilePicture).toBeNull();
    });

    it("should return 400 when attempting to delete non-existent profile picture", async () => {
      const res = await request(app)
        .delete("/api/profile/picture")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("No profile picture to delete");
    });
  });
});
