import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

const app = createApp();

describe("Posts Integration Tests", () => {
  let authorToken: string;
  let readerToken: string;
  let authorId: string;
  let readerId: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.postTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.reaction.deleteMany();
    await prisma.bookmark.deleteMany();
    await prisma.postRevision.deleteMany();
    await prisma.postView.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const author = await prisma.user.create({
      data: {
        firstName: "Jane",
        lastName: "Author",
        email: "author@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    authorId = author.id;
    authorToken = jwt.sign({ userId: author.id, email: author.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);

    const reader = await prisma.user.create({
      data: {
        firstName: "Bob",
        lastName: "Reader",
        email: "reader@example.com",
        password: "hashedpassword",
        role: "READER",
        isVerified: true,
      },
    });
    readerId = reader.id;
    readerToken = jwt.sign({ userId: reader.id, email: reader.email, role: "READER" }, env.JWT_ACCESS_SECRET);
  });

  it("POST /api/posts - should create a post draft with rendered markdown and auto-generated slug", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Modern API Architecture in 2026",
        content: "# Heading\n\nThis is **high performance** TypeScript code.",
        tags: ["Architecture", "TypeScript"],
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.slug).toBe("modern-api-architecture-in-2026");
    expect(res.body.data.contentHtml).toContain("<h1>Heading</h1>");
    expect(res.body.data.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    expect(res.body.data.tags).toHaveLength(2);
  });

  it("POST /api/posts - should reject creation by unauthorized READER role with 403", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${readerToken}`)
      .send({
        title: "Unauthorized Post",
        content: "Content goes here that is long enough",
      });

    expect(res.status).toBe(403);
  });

  it("GET /api/posts - should list published posts with cursor pagination", async () => {
    // Create 3 posts (2 published, 1 draft)
    const p1 = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Post One",
        content: "This is long content for post one.",
        status: "PUBLISHED",
      });
    expect(p1.status).toBe(201);

    const p2 = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Post Two",
        content: "This is long content for post two.",
        status: "PUBLISHED",
      });
    expect(p2.status).toBe(201);

    const p3 = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Draft Post",
        content: "This is draft content that is long.",
        status: "DRAFT",
      });
    expect(p3.status).toBe(201);

    const res = await request(app).get("/api/posts?limit=10");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data).toHaveLength(2); // Only published
    expect(res.body.pagination.hasNextPage).toBe(false);
  });

  it("GET /api/posts/slug/:slug - should return full post with TOC and author details", async () => {
    const createRes = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Deep Dive into NodeNext",
        content: "# Intro\nOverview here in detail\n\n## Section 1\nDetails here in depth",
        status: "PUBLISHED",
      });

    const slug = createRes.body.data.slug;

    const res = await request(app).get(`/api/posts/slug/${slug}`);

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(slug);
    expect(res.body.data.tableOfContents).toHaveLength(2);
    expect(res.body.data.author.firstName).toBe("Jane");
  });

  it("PUT /api/posts/:id - should update post and record revision history", async () => {
    const createRes = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Original Title",
        content: "Original Content with plenty of length",
      });

    const postId = createRes.body.data.id;

    const updateRes = await request(app)
      .put(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Updated Title",
        content: "Updated Content with **Markdown** formatting",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe("Updated Title");

    // Check revisions
    const revRes = await request(app)
      .get(`/api/posts/${postId}/revisions`)
      .set("Authorization", `Bearer ${authorToken}`);

    expect(revRes.status).toBe(200);
    expect(revRes.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/posts/:id/publish, archive, restore & delete lifecycle", async () => {
    const createRes = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        title: "Lifecycle Post",
        content: "Content with enough character length here",
      });

    expect(createRes.status).toBe(201);
    const postId = createRes.body.data.id;

    // 1. Publish
    const pubRes = await request(app)
      .post(`/api/posts/${postId}/publish`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe("PUBLISHED");

    // 2. Archive
    const archRes = await request(app)
      .post(`/api/posts/${postId}/archive`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(archRes.status).toBe(200);
    expect(archRes.body.data.status).toBe("ARCHIVED");

    // 3. Soft delete
    const delRes = await request(app)
      .delete(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(delRes.status).toBe(200);

    // 4. Restore
    const restRes = await request(app)
      .post(`/api/posts/${postId}/restore`)
      .set("Authorization", `Bearer ${authorToken}`);
    expect(restRes.status).toBe(200);
    expect(restRes.body.data.deletedAt).toBeNull();
  });
});
