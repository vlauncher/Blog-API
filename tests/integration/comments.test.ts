import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

const app = createApp();

describe("Comments Integration Tests", () => {
  let authorToken: string;
  let readerToken: string;
  let authorId: string;
  let readerId: string;
  let postId: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.notification.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const author = await prisma.user.create({
      data: {
        firstName: "Author",
        lastName: "Smith",
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
        firstName: "Reader",
        lastName: "Jones",
        email: "reader@example.com",
        password: "hashedpassword",
        role: "READER",
        isVerified: true,
      },
    });
    readerId = reader.id;
    readerToken = jwt.sign({ userId: reader.id, email: reader.email, role: "READER" }, env.JWT_ACCESS_SECRET);

    const post = await prisma.post.create({
      data: {
        title: "Test Post For Comments",
        slug: "test-post-for-comments",
        content: "Content goes here",
        status: "PUBLISHED",
        authorId,
      },
    });
    postId = post.id;
  });

  it("should create root comments and nested replies, and return threaded response", async () => {
    // 1. Reader creates root comment
    const rootRes = await request(app)
      .post(`/api/comments/post/${postId}`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({ content: "Great article!" });

    expect(rootRes.status).toBe(201);
    const rootId = rootRes.body.data.id;

    // 2. Author replies to reader comment
    const replyRes = await request(app)
      .post(`/api/comments/post/${postId}`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: "Thanks for reading!", parentId: rootId });

    expect(replyRes.status).toBe(201);

    // 3. Get threaded comments
    const listRes = await request(app).get(`/api/comments/post/${postId}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].content).toBe("Great article!");
    expect(listRes.body.data[0].replies).toHaveLength(1);
    expect(listRes.body.data[0].replies[0].content).toBe("Thanks for reading!");
  });

  it("should edit comment and soft delete comment", async () => {
    const rootRes = await request(app)
      .post(`/api/comments/post/${postId}`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({ content: "Initial text" });

    const commentId = rootRes.body.data.id;

    // Update
    const updateRes = await request(app)
      .put(`/api/comments/${commentId}`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({ content: "Edited text" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.content).toBe("Edited text");
    expect(updateRes.body.data.isEdited).toBe(true);

    // Soft delete
    const delRes = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set("Authorization", `Bearer ${readerToken}`);

    expect(delRes.status).toBe(200);

    // Verify deleted comment is omitted from listing
    const listRes = await request(app).get(`/api/comments/post/${postId}`);
    expect(listRes.body.data).toHaveLength(0);
  });
});
