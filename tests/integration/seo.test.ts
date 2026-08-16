import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

const app = createApp();

describe("SEO & Feeds Integration Tests", () => {
  beforeEach(async () => {
    await redis.flushall();
    await prisma.postTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.category.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const author = await prisma.user.create({
      data: {
        firstName: "Linus",
        lastName: "Torvalds",
        email: "linus@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });

    const category = await prisma.category.create({
      data: {
        name: "Linux",
        slug: "linux",
      },
    });

    const tag = await prisma.tag.create({
      data: {
        name: "Kernel",
        slug: "kernel",
      },
    });

    const post = await prisma.post.create({
      data: {
        title: "Kernel 7.0 Release Notes",
        slug: "kernel-7-0-release-notes",
        content: "New kernel features.",
        status: "PUBLISHED",
        authorId: author.id,
        categoryId: category.id,
        publishedAt: new Date(),
      },
    });

    await prisma.postTag.create({
      data: {
        postId: post.id,
        tagId: tag.id,
      },
    });
  });

  it("GET /feed.xml - should generate valid RSS 2.0 XML feed", async () => {
    const res = await request(app).get("/feed.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.text).toContain("<rss version=\"2.0\"");
    expect(res.text).toContain("Kernel 7.0 Release Notes");
  });

  it("GET /feed.json - should generate valid JSON Feed 1.1", async () => {
    const res = await request(app).get("/feed.json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/feed+json");
    const json = JSON.parse(res.text);
    expect(json.version).toContain("https://jsonfeed.org/version/");
    expect(json.items).toHaveLength(1);
    expect(json.items[0].title).toBe("Kernel 7.0 Release Notes");
  });

  it("GET /sitemap.xml - should generate XML sitemap with posts, categories, and tags", async () => {
    const res = await request(app).get("/sitemap.xml");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.text).toContain("<urlset");
    expect(res.text).toContain("/posts/kernel-7-0-release-notes");
    expect(res.text).toContain("/categories/linux");
    expect(res.text).toContain("/tags/kernel");
  });

  it("GET /api/seo/structured-data/:slug - should return Schema.org JSON-LD structured data", async () => {
    const res = await request(app).get("/api/seo/structured-data/kernel-7-0-release-notes");

    expect(res.status).toBe(200);
    expect(res.body.data["@type"]).toBe("BlogPosting");
    expect(res.body.data.headline).toBe("Kernel 7.0 Release Notes");
    expect(res.body.data.author.name).toBe("Linus Torvalds");
  });
});
