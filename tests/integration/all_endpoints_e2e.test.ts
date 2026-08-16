import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from "@jest/globals";
import request from "supertest";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

const app = createApp();

describe("Full Platform 55+ Endpoint Production Verification (E2E)", () => {
  let authorToken: string;
  let readerToken: string;
  let adminToken: string;
  let authorId: string;
  let readerId: string;
  let adminId: string;

  let categoryId: string;
  let categorySlug: string;
  let tagId: string;
  let tagSlug: string;
  let postId: string;
  let postSlug: string;
  let commentId: string;
  let notificationId: string;
  let webhookId: string;

  let mockUploadStream: any;
  let mockDestroy: any;

  beforeAll(async () => {
    await prisma.postTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.reaction.deleteMany();
    await prisma.bookmark.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.postRevision.deleteMany();
    await prisma.postView.deleteMany();
    await prisma.post.deleteMany();
    await prisma.category.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.subscriber.deleteMany();
    await prisma.webhook.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  });

  beforeEach(() => {
    mockUploadStream = jest
      .spyOn(cloudinary.uploader, "upload_stream")
      .mockImplementation((_opts: any, cb: any) => {
        cb(null, {
          secure_url: "https://res.cloudinary.com/demo/image/upload/v1/blog/test.webp",
          public_id: "blog/test-public-id",
          format: "webp",
          bytes: 10240,
          width: 800,
          height: 800,
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
    mockUploadStream?.mockRestore();
    mockDestroy?.mockRestore();
  });

  // ============================================================================
  // 1. Root & Documentation Endpoints
  // ============================================================================
  describe("1. Documentation & System Endpoints", () => {
    it("GET / should serve ReDoc HTML UI", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("<redoc");
      expect(res.text).toContain("ReDoc Documentation");
    });

    it("GET /docs should serve Swagger UI", async () => {
      const res = await request(app).get("/docs/");
      expect(res.status).toBe(200);
      expect(res.text).toContain("swagger-ui");
    });

    it("GET /docs/swagger.json should return OpenAPI 3.0 specification", async () => {
      const res = await request(app).get("/docs/swagger.json");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("openapi", "3.0.3");
      expect(res.body.info).toHaveProperty("title", "Blog API");
    });

    it("GET /api/health should perform deep checks on SQLite & Redis", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body.services).toEqual({
        database: "connected",
        redis: "connected",
      });
    });
  });

  // ============================================================================
  // 2. Authentication & User Management Lifecycle
  // ============================================================================
  describe("2. Authentication & Lifecycle Workflows", () => {
    it("POST /api/auth/register should register author, reader, and admin", async () => {
      // 1. Register Author
      const regAuthor = await request(app).post("/api/auth/register").send({
        firstName: "Alice",
        lastName: "Writer",
        email: "alice.author@example.com",
        password: "Password123",
      });
      expect(regAuthor.status).toBe(201);
      authorId = regAuthor.body.user.id;

      // Verify Author Email via Redis OTP
      const authorOtp = await redis.get("otp:verify:alice.author@example.com");
      expect(authorOtp).toBeDefined();

      const verAuthor = await request(app).post("/api/auth/verify-email").send({
        email: "alice.author@example.com",
        otp: authorOtp!,
      });
      expect(verAuthor.status).toBe(200);

      // Upgrade to AUTHOR role in DB
      await prisma.user.update({
        where: { id: authorId },
        data: { role: "AUTHOR" },
      });

      // 2. Register Reader
      const regReader = await request(app).post("/api/auth/register").send({
        firstName: "Bob",
        lastName: "Reader",
        email: "bob.reader@example.com",
        password: "Password123",
      });
      expect(regReader.status).toBe(201);
      readerId = regReader.body.user.id;

      const readerOtp = await redis.get("otp:verify:bob.reader@example.com");
      await request(app).post("/api/auth/verify-email").send({
        email: "bob.reader@example.com",
        otp: readerOtp!,
      });

      // 3. Register Admin
      const regAdmin = await request(app).post("/api/auth/register").send({
        firstName: "Super",
        lastName: "Admin",
        email: "admin@example.com",
        password: "Password123",
      });
      expect(regAdmin.status).toBe(201);
      adminId = regAdmin.body.user.id;

      const adminOtp = await redis.get("otp:verify:admin@example.com");
      await request(app).post("/api/auth/verify-email").send({
        email: "admin@example.com",
        otp: adminOtp!,
      });

      await prisma.user.update({
        where: { id: adminId },
        data: { role: "ADMIN" },
      });
    });

    it("POST /api/auth/resend-otp should handle rate-limited OTP resend", async () => {
      // Register an unverified user
      await request(app).post("/api/auth/register").send({
        firstName: "Temp",
        lastName: "User",
        email: "temp@example.com",
        password: "Password123",
      });

      const res = await request(app).post("/api/auth/resend-otp").send({
        email: "temp@example.com",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("remainingAttempts");
    });

    it("POST /api/auth/login should authenticate and return tokens", async () => {
      // Login Author
      const resAuthor = await request(app).post("/api/auth/login").send({
        email: "alice.author@example.com",
        password: "Password123",
      });
      expect(resAuthor.status).toBe(200);
      authorToken = resAuthor.body.accessToken;

      // Login Reader
      const resReader = await request(app).post("/api/auth/login").send({
        email: "bob.reader@example.com",
        password: "Password123",
      });
      expect(resReader.status).toBe(200);
      readerToken = resReader.body.accessToken;

      // Login Admin
      const resAdmin = await request(app).post("/api/auth/login").send({
        email: "admin@example.com",
        password: "Password123",
      });
      expect(resAdmin.status).toBe(200);
      adminToken = resAdmin.body.accessToken;
    });

    it("POST /api/auth/refresh-token should rotate tokens", async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: "bob.reader@example.com",
        password: "Password123",
      });

      const refreshRes = await request(app).post("/api/auth/refresh-token").send({
        refreshToken: loginRes.body.refreshToken,
      });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty("accessToken");
      expect(refreshRes.body).toHaveProperty("refreshToken");
    });

    it("POST /api/auth/change-password should update credentials", async () => {
      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${readerToken}`)
        .send({
          currentPassword: "Password123",
          newPassword: "NewPassword123",
        });
      expect(res.status).toBe(200);

      // Restore password
      await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${readerToken}`)
        .send({
          currentPassword: "NewPassword123",
          newPassword: "Password123",
        });
    });

    it("POST /api/auth/forgot-password and /reset-password should work via OTP", async () => {
      const forgotRes = await request(app).post("/api/auth/forgot-password").send({
        email: "bob.reader@example.com",
      });
      expect(forgotRes.status).toBe(200);

      const resetOtp = await redis.get("otp:reset:bob.reader@example.com");
      expect(resetOtp).toBeDefined();

      const resetRes = await request(app).post("/api/auth/reset-password").send({
        email: "bob.reader@example.com",
        otp: resetOtp!,
        newPassword: "Password123",
      });
      expect(resetRes.status).toBe(200);
    });

    it("POST /api/auth/logout should revoke active sessions", async () => {
      const tempLogin = await request(app).post("/api/auth/login").send({
        email: "bob.reader@example.com",
        password: "Password123",
      });

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${tempLogin.body.accessToken}`)
        .send({ refreshToken: tempLogin.body.refreshToken });

      expect(logoutRes.status).toBe(200);
    });
  });

  // ============================================================================
  // 3. User Profile Management
  // ============================================================================
  describe("3. Profile Management", () => {
    it("GET & PATCH /api/profile should manage profile information", async () => {
      // Get Profile
      const getRes = await request(app)
        .get("/api/profile")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.email).toBe("alice.author@example.com");

      // Update Profile
      const patchRes = await request(app)
        .patch("/api/profile")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          age: 29,
          bio: "Senior Software Engineer & Tech Blogger",
          phoneNumber: "+1234567890",
          address: "123 Innovation Drive",
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.bio).toBe("Senior Software Engineer & Tech Blogger");
      expect(patchRes.body.data.age).toBe(29);
    });

    it("PATCH & DELETE /api/profile/picture should manage profile images", async () => {
      const validImageBuffer = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 4,
          background: { r: 100, g: 150, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      // Upload picture
      const uploadRes = await request(app)
        .patch("/api/profile/picture")
        .set("Authorization", `Bearer ${authorToken}`)
        .attach("picture", validImageBuffer, "avatar.png");

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.data).toHaveProperty("profilePicture");

      // Delete picture
      const deleteRes = await request(app)
        .delete("/api/profile/picture")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.profilePicture).toBeNull();
    });
  });

  // ============================================================================
  // 4. Categories & Tags Taxonomy
  // ============================================================================
  describe("4. Categories & Tags Taxonomy", () => {
    it("POST, GET, PUT, DELETE /api/categories should manage category hierarchy", async () => {
      // 1. Create Parent Category
      const parentRes = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          name: "Software Engineering",
          description: "All things software architecture and code",
        });
      expect(parentRes.status).toBe(201);
      categoryId = parentRes.body.data.id;
      categorySlug = parentRes.body.data.slug;

      // 2. Create Child Category
      const childRes = await request(app)
        .post("/api/categories")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          name: "TypeScript",
          description: "TypeScript tutorials and best practices",
          parentId: categoryId,
        });
      expect(childRes.status).toBe(201);

      // 3. Get Category Tree
      const treeRes = await request(app).get("/api/categories");
      expect(treeRes.status).toBe(200);
      expect(Array.isArray(treeRes.body.data)).toBe(true);

      // 4. Get By Slug
      const slugRes = await request(app).get(`/api/categories/${categorySlug}`);
      expect(slugRes.status).toBe(200);
      expect(slugRes.body.data.name).toBe("Software Engineering");

      // 5. Update Category (Admin)
      const updateRes = await request(app)
        .put(`/api/categories/${categoryId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ description: "Updated description for SE" });
      expect(updateRes.status).toBe(200);
    });

    it("POST, GET, DELETE /api/tags should manage tag taxonomy", async () => {
      // 1. Create Tag
      const tagRes = await request(app)
        .post("/api/tags")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({ name: "Architecture" });
      expect(tagRes.status).toBe(201);
      tagId = tagRes.body.data.id;
      tagSlug = tagRes.body.data.slug;

      // 2. Get Tags
      const listRes = await request(app).get("/api/tags");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      // 3. Get Tag By Slug
      const singleRes = await request(app).get(`/api/tags/${tagSlug}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.data.name).toBe("Architecture");
    });
  });

  // ============================================================================
  // 5. Media Uploads
  // ============================================================================
  describe("5. Media Uploads", () => {
    it("POST & DELETE /api/media should upload & delete optimized media", async () => {
      const validImageBuffer = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 4,
          background: { r: 50, g: 100, b: 150, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const uploadRes = await request(app)
        .post("/api/media/upload")
        .set("Authorization", `Bearer ${authorToken}`)
        .attach("picture", validImageBuffer, "cover.png");

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data).toHaveProperty("url");
      expect(uploadRes.body.data).toHaveProperty("publicId");

      const deleteRes = await request(app)
        .delete(`/api/media/${uploadRes.body.data.publicId}`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(deleteRes.status).toBe(200);
    });
  });

  // ============================================================================
  // 6. Posts Publishing Lifecycle & Revisions
  // ============================================================================
  describe("6. Posts Publishing Lifecycle & Version History", () => {
    it("POST /api/posts should create post draft with Markdown and TOC calculation", async () => {
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Building Modern Scalable Backend Systems in 2026",
          content: "# Introduction\n\nModern APIs must be fast.\n\n## Architecture\n\nMicroservices and clean architecture.\n\n### Database\n\nSQLite with Prisma.",
          categoryId,
          tags: ["Architecture", "Backend", "TypeScript"],
        });

      expect(res.status).toBe(201);
      postId = res.body.data.id;
      postSlug = res.body.data.slug;
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/posts and /api/posts/slug/:slug should retrieve posts", async () => {
      // Get by ID
      const byId = await request(app).get(`/api/posts/${postId}`);
      expect(byId.status).toBe(200);

      // Publish post
      const pubRes = await request(app)
        .post(`/api/posts/${postId}/publish`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe("PUBLISHED");

      // Query posts with cursor pagination and category filter
      const listRes = await request(app).get("/api/posts?limit=10");
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(listRes.body.pagination).toHaveProperty("hasNextPage");

      // Get by slug
      const slugRes = await request(app)
        .get(`/api/posts/slug/${postSlug}`)
        .set("Authorization", `Bearer ${readerToken}`);
      expect(slugRes.status).toBe(200);
      expect(slugRes.body.data.tableOfContents.length).toBe(3);
    });

    it("PUT, /schedule, /archive, /restore should manage post lifecycle", async () => {
      // Update Post (generates Revision 2)
      const updateRes = await request(app)
        .put(`/api/posts/${postId}`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          title: "Building Modern Scalable Backend Systems in 2026 - Updated",
          content: "# Updated Heading\n\nNew refreshed content for 2026.",
        });
      expect(updateRes.status).toBe(200);

      // Get Revisions
      const revRes = await request(app)
        .get(`/api/posts/${postId}/revisions`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(revRes.status).toBe(200);
      expect(revRes.body.data.length).toBeGreaterThanOrEqual(2);

      // Restore Revision 1
      const rev1Id = revRes.body.data[revRes.body.data.length - 1].id;
      const restoreRev = await request(app)
        .post(`/api/posts/${postId}/revisions/${rev1Id}/restore`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(restoreRev.status).toBe(200);

      // Schedule post
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const schedRes = await request(app)
        .post(`/api/posts/${postId}/schedule`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({ scheduledPublishAt: futureDate });
      expect(schedRes.status).toBe(200);
      expect(schedRes.body.data.status).toBe("SCHEDULED");

      // Archive post
      const archRes = await request(app)
        .post(`/api/posts/${postId}/archive`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(archRes.status).toBe(200);
      expect(archRes.body.data.status).toBe("ARCHIVED");

      // Re-publish for subsequent social tests
      await request(app)
        .post(`/api/posts/${postId}/publish`)
        .set("Authorization", `Bearer ${authorToken}`);
    });
  });

  // ============================================================================
  // 7. Comments, Reactions, Bookmarks & Follows
  // ============================================================================
  describe("7. Engagement & Social Features", () => {
    it("POST, GET, PUT, DELETE /api/comments should handle threaded comments", async () => {
      // 1. Root comment
      const rootRes = await request(app)
        .post(`/api/comments/post/${postId}`)
        .set("Authorization", `Bearer ${readerToken}`)
        .send({ content: "Outstanding article! Very insightful." });
      expect(rootRes.status).toBe(201);
      commentId = rootRes.body.data.id;

      // 2. Threaded reply
      const replyRes = await request(app)
        .post(`/api/comments/post/${postId}`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          content: "Thank you Bob! Glad you enjoyed it.",
          parentId: commentId,
        });
      expect(replyRes.status).toBe(201);

      // 3. Get threaded comments
      const treeRes = await request(app).get(`/api/comments/post/${postId}`);
      expect(treeRes.status).toBe(200);
      expect(treeRes.body.data[0].replies.length).toBe(1);

      // 4. Update comment
      const updateRes = await request(app)
        .put(`/api/comments/${commentId}`)
        .set("Authorization", `Bearer ${readerToken}`)
        .send({ content: "Outstanding article! Edited with more praises." });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.isEdited).toBe(true);

      // 5. Delete reply
      const delRes = await request(app)
        .delete(`/api/comments/${replyRes.body.data.id}`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(delRes.status).toBe(200);
    });

    it("POST & GET /api/reactions should handle multi-type reactions", async () => {
      // Add reaction
      const reactRes = await request(app)
        .post(`/api/reactions/post/${postId}`)
        .set("Authorization", `Bearer ${readerToken}`)
        .send({ type: "CLAP" });
      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.action).toBe("added");

      // Get reactions breakdown
      const getReactions = await request(app)
        .get(`/api/reactions/post/${postId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      expect(getReactions.status).toBe(200);
      expect(getReactions.body.data.counts.CLAP).toBe(1);
      expect(getReactions.body.data.userReaction).toBe("CLAP");
    });

    it("POST & GET /api/bookmarks should toggle and retrieve bookmarks", async () => {
      // Toggle on
      const addRes = await request(app)
        .post(`/api/bookmarks/post/${postId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      expect(addRes.status).toBe(200);
      expect(addRes.body.data.isBookmarked).toBe(true);

      // List bookmarks
      const listRes = await request(app)
        .get("/api/bookmarks")
        .set("Authorization", `Bearer ${readerToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
    });

    it("POST & GET /api/follows should toggle and query author follows", async () => {
      // Reader follows Author
      const followRes = await request(app)
        .post(`/api/follows/user/${authorId}`)
        .set("Authorization", `Bearer ${readerToken}`);
      expect(followRes.status).toBe(200);
      expect(followRes.body.data.isFollowing).toBe(true);

      // Get Followers of Author
      const followersRes = await request(app).get(`/api/follows/user/${authorId}/followers`);
      expect(followersRes.status).toBe(200);
      expect(followersRes.body.data.length).toBe(1);

      // Get Following of Reader
      const followingRes = await request(app).get(`/api/follows/user/${readerId}/following`);
      expect(followingRes.status).toBe(200);
      expect(followingRes.body.data.length).toBe(1);
    });
  });

  // ============================================================================
  // 8. Search, Analytics & SEO Feeds
  // ============================================================================
  describe("8. Search, Analytics & SEO Feeds", () => {
    it("GET /api/search should return matching posts across taxonomy", async () => {
      const res = await request(app).get("/api/search?q=Backend");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it("POST & GET /api/analytics should track views, dashboards and trending", async () => {
      // Record View
      const viewRes = await request(app)
        .post(`/api/analytics/view/${postId}`)
        .send({
          readPercent: 90,
          referrer: "https://google.com",
        });
      expect(viewRes.status).toBe(200);

      // Post Analytics
      const postAnalytics = await request(app)
        .get(`/api/analytics/posts/${postId}`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(postAnalytics.status).toBe(200);
      expect(postAnalytics.body.data.totalViews).toBeGreaterThanOrEqual(1);

      // Author Dashboard
      const dashRes = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(dashRes.status).toBe(200);
      expect(dashRes.body.data).toHaveProperty("totalPosts");
      expect(dashRes.body.data).toHaveProperty("totalFollowers");

      // Trending posts
      const trendRes = await request(app).get("/api/analytics/trending");
      expect(trendRes.status).toBe(200);
      expect(Array.isArray(trendRes.body.data)).toBe(true);
    });

    it("GET /feed.xml, /feed.json, /sitemap.xml, /api/seo/structured-data/:slug should serve SEO", async () => {
      // RSS Feed
      const rssRes = await request(app).get("/feed.xml");
      expect(rssRes.status).toBe(200);
      expect(rssRes.headers["content-type"]).toContain("xml");

      // JSON Feed
      const jsonRes = await request(app).get("/feed.json");
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.headers["content-type"]).toContain("json");

      // XML Sitemap
      const sitemapRes = await request(app).get("/sitemap.xml");
      expect(sitemapRes.status).toBe(200);
      expect(sitemapRes.text).toContain("<urlset");

      // Structured Data
      const structRes = await request(app).get(`/api/seo/structured-data/${postSlug}`);
      expect(structRes.status).toBe(200);
      expect(structRes.body.data["@type"]).toBe("BlogPosting");
    });
  });

  // ============================================================================
  // 9. Notifications, Newsletter & Webhooks
  // ============================================================================
  describe("9. Real-time Notifications, Newsletter & Webhooks", () => {
    it("GET & PUT /api/notifications should manage notifications", async () => {
      // List Notifications
      const notifs = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(notifs.status).toBe(200);
      expect(notifs.body.data.length).toBeGreaterThan(0);
      notificationId = notifs.body.data[0].id;

      // Unread Count
      const countRes = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(countRes.status).toBe(200);
      expect(countRes.body.data).toHaveProperty("unreadCount");

      // Mark single as read
      const markSingle = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(markSingle.status).toBe(200);
      expect(markSingle.body.data.isRead).toBe(true);

      // Mark all as read
      const markAll = await request(app)
        .put("/api/notifications/read-all")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(markAll.status).toBe(200);
    });

    it("POST, GET /api/newsletter should manage double opt-in subscriptions", async () => {
      // 1. Subscribe
      const subRes = await request(app).post("/api/newsletter/subscribe").send({
        email: "subscriber@example.com",
      });
      expect(subRes.status).toBe(200);

      // Find token in DB
      const sub = await prisma.subscriber.findUnique({
        where: { email: "subscriber@example.com" },
      });
      expect(sub?.confirmToken).toBeDefined();

      // 2. Confirm subscription
      const confirmRes = await request(app).get(`/api/newsletter/confirm/${sub!.confirmToken}`);
      expect(confirmRes.status).toBe(200);

      // 3. List subscribers (Admin)
      const listSub = await request(app)
        .get("/api/newsletter/subscribers")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listSub.status).toBe(200);
      expect(listSub.body.data.length).toBe(1);

      // 4. Unsubscribe
      const unsubRes = await request(app).get(`/api/newsletter/unsubscribe/${sub!.unsubToken}`);
      expect(unsubRes.status).toBe(200);
    });

    it("POST, GET, DELETE /api/webhooks should manage user webhooks", async () => {
      // 1. Create Webhook
      const createRes = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          url: "https://example.com/webhook-receiver",
          secret: "super-secure-webhook-secret-key",
          events: ["post.published", "comment.created"],
        });
      expect(createRes.status).toBe(201);
      webhookId = createRes.body.data.id;

      // 2. List Webhooks
      const listRes = await request(app)
        .get("/api/webhooks")
        .set("Authorization", `Bearer ${authorToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);

      // 3. Delete Webhook
      const deleteRes = await request(app)
        .delete(`/api/webhooks/${webhookId}`)
        .set("Authorization", `Bearer ${authorToken}`);
      expect(deleteRes.status).toBe(200);
    });
  });
});

