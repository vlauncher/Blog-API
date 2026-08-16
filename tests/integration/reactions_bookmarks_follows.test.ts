import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

const app = createApp();

describe("Reactions, Bookmarks & Follows Integration Tests", () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let postId: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.notification.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.bookmark.deleteMany();
    await prisma.reaction.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();

    const u1 = await prisma.user.create({
      data: {
        firstName: "Alice",
        lastName: "Author",
        email: "alice@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    user1Id = u1.id;
    user1Token = jwt.sign({ userId: u1.id, email: u1.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);

    const u2 = await prisma.user.create({
      data: {
        firstName: "Bob",
        lastName: "Reader",
        email: "bob@example.com",
        password: "hashedpassword",
        role: "READER",
        isVerified: true,
      },
    });
    user2Id = u2.id;
    user2Token = jwt.sign({ userId: u2.id, email: u2.email, role: "READER" }, env.JWT_ACCESS_SECRET);

    const post = await prisma.post.create({
      data: {
        title: "Test Social Post",
        slug: "test-social-post",
        content: "Content",
        status: "PUBLISHED",
        authorId: user1Id,
      },
    });
    postId = post.id;
  });

  it("Reactions - should toggle reaction on post and return breakdown", async () => {
    // 1. Add CLAP reaction
    const addRes = await request(app)
      .post(`/api/reactions/post/${postId}`)
      .set("Authorization", `Bearer ${user2Token}`)
      .send({ type: "CLAP" });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.action).toBe("added");

    // 2. Get post reactions
    const getRes = await request(app)
      .get(`/api/reactions/post/${postId}`)
      .set("Authorization", `Bearer ${user2Token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.total).toBe(1);
    expect(getRes.body.data.counts.CLAP).toBe(1);
    expect(getRes.body.data.userReaction).toBe("CLAP");

    // 3. Remove CLAP reaction (un-react)
    const removeRes = await request(app)
      .post(`/api/reactions/post/${postId}`)
      .set("Authorization", `Bearer ${user2Token}`)
      .send({ type: "CLAP" });

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.data.action).toBe("removed");
  });

  it("Bookmarks - should toggle bookmark and list user's saved posts", async () => {
    // 1. Bookmark post
    const bookRes = await request(app)
      .post(`/api/bookmarks/post/${postId}`)
      .set("Authorization", `Bearer ${user2Token}`);

    expect(bookRes.status).toBe(200);
    expect(bookRes.body.data.isBookmarked).toBe(true);

    // 2. List bookmarks
    const listRes = await request(app)
      .get("/api/bookmarks")
      .set("Authorization", `Bearer ${user2Token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].post.title).toBe("Test Social Post");

    // 3. Unbookmark
    const unbookRes = await request(app)
      .post(`/api/bookmarks/post/${postId}`)
      .set("Authorization", `Bearer ${user2Token}`);

    expect(unbookRes.status).toBe(200);
    expect(unbookRes.body.data.isBookmarked).toBe(false);
  });

  it("Follows - should follow author, retrieve followers and following lists", async () => {
    // 1. Bob follows Alice
    const followRes = await request(app)
      .post(`/api/follows/user/${user1Id}`)
      .set("Authorization", `Bearer ${user2Token}`);

    expect(followRes.status).toBe(200);
    expect(followRes.body.data.isFollowing).toBe(true);

    // 2. Get Alice's followers
    const followersRes = await request(app).get(`/api/follows/user/${user1Id}/followers`);
    expect(followersRes.status).toBe(200);
    expect(followersRes.body.data).toHaveLength(1);
    expect(followersRes.body.data[0].user.firstName).toBe("Bob");

    // 3. Get Bob's following list
    const followingRes = await request(app).get(`/api/follows/user/${user2Id}/following`);
    expect(followingRes.status).toBe(200);
    expect(followingRes.body.data).toHaveLength(1);
    expect(followingRes.body.data[0].user.firstName).toBe("Alice");

    // 4. Bob unfollows Alice
    const unfollowRes = await request(app)
      .post(`/api/follows/user/${user1Id}`)
      .set("Authorization", `Bearer ${user2Token}`);
    expect(unfollowRes.status).toBe(200);
    expect(unfollowRes.body.data.isFollowing).toBe(false);
  });
});
