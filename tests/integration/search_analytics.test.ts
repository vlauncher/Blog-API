import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

const app = createApp();

describe("Search & Analytics Integration Tests", () => {
  let authorToken: string;
  let authorId: string;
  let postId: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.postTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.postView.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const author = await prisma.user.create({
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    authorId = author.id;
    authorToken = jwt.sign({ userId: author.id, email: author.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);

    const post = await prisma.post.create({
      data: {
        title: "Introduction to Quantum Algorithms",
        slug: "introduction-to-quantum-algorithms",
        content: "Detailed post about quantum computing.",
        status: "PUBLISHED",
        authorId,
      },
    });
    postId = post.id;
  });

  it("Search - should return matching posts by keyword query", async () => {
    const res = await request(app).get("/api/search?q=Quantum");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toContain("Quantum");
  });

  it("Analytics - should track post view with read percentage and update trending leaderboard", async () => {
    // 1. Record View
    const viewRes = await request(app)
      .post(`/api/analytics/view/${postId}`)
      .send({ readPercent: 90, referrer: "https://twitter.com" });

    expect(viewRes.status).toBe(200);
    expect(viewRes.body.status).toBe("success");

    // 2. Fetch post analytics
    const statsRes = await request(app)
      .get(`/api/analytics/posts/${postId}`)
      .set("Authorization", `Bearer ${authorToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totalViews).toBe(1);
    expect(statsRes.body.data.avgReadPercent).toBe(90);

    // 3. Fetch author dashboard overview
    const dashRes = await request(app)
      .get("/api/analytics/dashboard")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalPosts).toBe(1);
    expect(dashRes.body.data.totalViews).toBe(1);

    // 4. Fetch trending posts
    const trendRes = await request(app).get("/api/analytics/trending");
    expect(trendRes.status).toBe(200);
    expect(trendRes.body.data.length).toBeGreaterThanOrEqual(1);
  });
});
