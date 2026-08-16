import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { prisma } from "../../../src/config/prisma.js";
import { redis } from "../../../src/config/redis.js";
import { categoriesService } from "../../../src/modules/categories/categories.service.js";
import { tagsService } from "../../../src/modules/tags/tags.service.js";
import { postsService } from "../../../src/modules/posts/posts.service.js";
import { commentsService } from "../../../src/modules/comments/comments.service.js";
import { followsService } from "../../../src/modules/follows/follows.service.js";
import { newsletterService } from "../../../src/modules/newsletter/newsletter.service.js";
import { webhooksService, WebhooksService } from "../../../src/modules/webhooks/webhooks.service.js";
import { analyticsService } from "../../../src/modules/analytics/analytics.service.js";
import { notificationsModuleService } from "../../../src/modules/notifications/notifications.service.js";
import { mediaService } from "../../../src/modules/media/media.service.js";
import { AppError } from "../../../src/utils/app-error.js";
import sharp from "sharp";

describe("Deep Coverage Unit Tests", () => {
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.notification.deleteMany();
    await prisma.subscriber.deleteMany();
    await prisma.webhook.deleteMany();
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
    await prisma.user.deleteMany();

    user1 = await prisma.user.create({
      data: {
        firstName: "User",
        lastName: "One",
        email: "user1@example.com",
        password: "password123",
        role: "AUTHOR",
        isVerified: true,
      },
    });

    user2 = await prisma.user.create({
      data: {
        firstName: "User",
        lastName: "Two",
        email: "user2@example.com",
        password: "password123",
        role: "READER",
        isVerified: true,
      },
    });
  });

  describe("CategoriesService Edge Cases", () => {
    it("should throw 404 for non-existent slug", async () => {
      await expect(categoriesService.getCategoryBySlug("unknown")).rejects.toThrow(AppError);
    });

    it("should throw 409 when creating duplicate category name", async () => {
      await categoriesService.createCategory({ name: "DevOps" });
      await expect(categoriesService.createCategory({ name: "DevOps" })).rejects.toThrow(AppError);
    });

    it("should throw 404 if parent category does not exist", async () => {
      await expect(categoriesService.createCategory({ name: "Sub", parentId: "nonexistent" })).rejects.toThrow(AppError);
    });

    it("should throw 400 if category is set as its own parent", async () => {
      const cat = await categoriesService.createCategory({ name: "SelfParent" });
      await expect(categoriesService.updateCategory(cat.id, { parentId: cat.id })).rejects.toThrow(AppError);
    });

    it("should throw 404 on updating or deleting non-existent category", async () => {
      await expect(categoriesService.updateCategory("nonexistent", { name: "New" })).rejects.toThrow(AppError);
      await expect(categoriesService.deleteCategory("nonexistent")).rejects.toThrow(AppError);
    });
  });

  describe("TagsService Edge Cases", () => {
    it("should throw 404 for non-existent tag slug", async () => {
      await expect(tagsService.getTagBySlug("nonexistent")).rejects.toThrow(AppError);
    });

    it("should throw 404 on updating or deleting non-existent tag", async () => {
      await expect(tagsService.updateTag("nonexistent", { name: "Tag" })).rejects.toThrow(AppError);
      await expect(tagsService.deleteTag("nonexistent")).rejects.toThrow(AppError);
    });
  });

  describe("MediaService Edge Cases", () => {
    it("should throw 400 when uploading empty buffer or deleting empty publicId", async () => {
      await expect(mediaService.uploadMedia(Buffer.from([]))).rejects.toThrow(AppError);
      await expect(mediaService.deleteMedia("")).rejects.toThrow(AppError);
    });
  });

  describe("PostsService Edge Cases", () => {
    it("should throw 404 for non-existent post", async () => {
      await expect(postsService.getPostBySlug("nonexistent")).rejects.toThrow(AppError);
      await expect(postsService.getPostById("nonexistent")).rejects.toThrow(AppError);
      await expect(postsService.publishPost("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);
      await expect(postsService.archivePost("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);
      await expect(postsService.deletePost("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);
      await expect(postsService.restorePost("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);
    });

    it("should throw 403 when non-author attempts to edit or publish post", async () => {
      const post = await postsService.createPost(user1.id, {
        title: "Protected Post",
        content: "Detailed post content here",
      });

      await expect(postsService.updatePost(post.id, user2.id, "READER", { title: "Hacked" })).rejects.toThrow(AppError);
      await expect(postsService.publishPost(post.id, user2.id, "READER")).rejects.toThrow(AppError);
      await expect(postsService.archivePost(post.id, user2.id, "READER")).rejects.toThrow(AppError);
      await expect(postsService.deletePost(post.id, user2.id, "READER")).rejects.toThrow(AppError);
      await expect(postsService.restorePost(post.id, user2.id, "READER")).rejects.toThrow(AppError);
      await expect(postsService.getRevisions(post.id, user2.id, "READER")).rejects.toThrow(AppError);
      await expect(postsService.restoreRevision(post.id, "rev-1", user2.id, "READER")).rejects.toThrow(AppError);
    });

    it("should throw 400 when scheduling with past or invalid date", async () => {
      const post = await postsService.createPost(user1.id, {
        title: "Scheduled Test",
        content: "Detailed post content here",
      });

      await expect(postsService.schedulePost(post.id, user1.id, "AUTHOR", "2020-01-01T00:00:00Z")).rejects.toThrow(AppError);
      await expect(postsService.schedulePost(post.id, user1.id, "AUTHOR", "invalid-date")).rejects.toThrow(AppError);
    });

    it("should allow restoring a revision", async () => {
      const post = await postsService.createPost(user1.id, {
        title: "Version 1 Title",
        content: "Version 1 Content is long enough",
      });

      await postsService.updatePost(post.id, user1.id, "AUTHOR", {
        title: "Version 2 Title",
        content: "Version 2 Content is long enough",
      });

      const revisions = await postsService.getRevisions(post.id, user1.id, "AUTHOR");
      expect(revisions.length).toBeGreaterThan(0);

      const restored = await postsService.restoreRevision(post.id, revisions[0].id, user1.id, "AUTHOR");
      expect(restored).toBeDefined();
    });
  });

  describe("CommentsService Edge Cases", () => {
    it("should throw 404 if post does not exist or parent comment does not exist", async () => {
      await expect(commentsService.getPostComments("nonexistent")).rejects.toThrow(AppError);
      await expect(commentsService.createComment("nonexistent", user1.id, { content: "Text" })).rejects.toThrow(AppError);

      const post = await postsService.createPost(user1.id, {
        title: "Commentable Post",
        content: "Post content for comments",
        status: "PUBLISHED",
      });

      await expect(commentsService.createComment(post.id, user1.id, { content: "Text", parentId: "nonexistent" })).rejects.toThrow(AppError);
    });

    it("should throw 404/403 for unauthorized comment edit or delete", async () => {
      await expect(commentsService.updateComment("nonexistent", user1.id, "AUTHOR", { content: "New" })).rejects.toThrow(AppError);
      await expect(commentsService.deleteComment("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);

      const post = await postsService.createPost(user1.id, {
        title: "Commentable Post 2",
        content: "Post content for comments 2",
        status: "PUBLISHED",
      });

      const comment = await commentsService.createComment(post.id, user1.id, { content: "My comment" });
      await expect(commentsService.updateComment(comment.id, user2.id, "READER", { content: "Hijack" })).rejects.toThrow(AppError);
      await expect(commentsService.deleteComment(comment.id, user2.id, "READER")).rejects.toThrow(AppError);
    });
  });

  describe("FollowsService Edge Cases", () => {
    it("should throw 400 when following self", async () => {
      await expect(followsService.toggleFollow(user1.id, user1.id)).rejects.toThrow(AppError);
    });

    it("should throw 404 when following non-existent user", async () => {
      await expect(followsService.toggleFollow(user1.id, "nonexistent")).rejects.toThrow(AppError);
    });
  });

  describe("NewsletterService Edge Cases", () => {
    it("should return friendly message if already confirmed subscriber", async () => {
      await prisma.subscriber.create({
        data: { email: "active@example.com", isConfirmed: true },
      });

      const res = await newsletterService.subscribe("active@example.com");
      expect(res.message).toContain("already subscribed");
    });

    it("should throw 400 for invalid confirm or unsubscribe token", async () => {
      await expect(newsletterService.confirmSubscription("invalid-token")).rejects.toThrow(AppError);
      await expect(newsletterService.unsubscribe("invalid-token")).rejects.toThrow(AppError);
    });
  });

  describe("WebhooksService Edge Cases", () => {
    it("should throw 404 for deleting non-existent webhook", async () => {
      await expect(webhooksService.deleteWebhook("nonexistent", user1.id)).rejects.toThrow(AppError);
    });

    it("should dispatch events safely without crashing", async () => {
      await WebhooksService.dispatchEvent("post.published", { test: 123 });
    });
  });

  describe("AnalyticsService Edge Cases", () => {
    it("should throw 404 for recording view or fetching analytics on non-existent post", async () => {
      await expect(analyticsService.recordView("nonexistent", "127.0.0.1", "agent")).rejects.toThrow(AppError);
      await expect(analyticsService.getPostAnalytics("nonexistent", user1.id, "AUTHOR")).rejects.toThrow(AppError);
    });

    it("should throw 403 if non-author attempts to view post analytics", async () => {
      const post = await postsService.createPost(user1.id, {
        title: "Post Analytics Test",
        content: "Detailed post content here",
        status: "PUBLISHED",
      });

      await expect(analyticsService.getPostAnalytics(post.id, user2.id, "READER")).rejects.toThrow(AppError);
    });
  });

  describe("NotificationsModuleService Edge Cases", () => {
    it("should throw 404 when marking non-existent notification as read", async () => {
      await expect(notificationsModuleService.markAsRead("nonexistent", user1.id)).rejects.toThrow(AppError);
    });
  });
});
