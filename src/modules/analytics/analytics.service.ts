import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../../utils/app-error.js";

export class AnalyticsService {
  async recordView(postId: string, ip: string, userAgent: string, readPercent?: number, referrer?: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId, status: "PUBLISHED", deletedAt: null },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    // Generate non-reversible visitor hash for privacy
    const visitorHash = crypto
      .createHash("sha256")
      .update(`${ip}:${userAgent}`)
      .digest("hex");

    // 1. Record in PostView table
    await prisma.postView.create({
      data: {
        postId,
        visitorHash,
        readPercent: readPercent ? Math.min(100, Math.max(0, readPercent)) : null,
        referrer,
      },
    });

    // 2. Increment total post view count
    await prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    });

    // 3. Increment Redis daily trending score
    try {
      await redis.zincrby("blog:trending:daily", 1, postId);
    } catch {
      // Redis tracking non-critical
    }

    return { message: "View recorded" };
  }

  async getPostAnalytics(postId: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("Forbidden", 403);
    }

    const views = await prisma.postView.findMany({
      where: { postId },
      select: {
        visitorHash: true,
        readPercent: true,
        referrer: true,
        createdAt: true,
      },
    });

    const totalViews = views.length;
    const uniqueVisitors = new Set(views.map((v) => v.visitorHash)).size;
    const viewsWithRead = views.filter((v) => v.readPercent !== null);
    const avgReadPercent =
      viewsWithRead.length > 0
        ? Math.round(
            viewsWithRead.reduce((acc, curr) => acc + (curr.readPercent || 0), 0) /
              viewsWithRead.length
          )
        : 0;

    return {
      postId,
      title: post.title,
      totalViews,
      uniqueVisitors,
      avgReadPercent,
    };
  }

  async getAuthorDashboard(authorId: string) {
    const posts = await prisma.post.findMany({
      where: { authorId, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        viewCount: true,
        publishedAt: true,
        _count: { select: { comments: true, reactions: true, bookmarks: true } },
      },
      orderBy: { viewCount: "desc" },
    });

    const followersCount = await prisma.follow.count({
      where: { followingId: authorId },
    });

    const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
    const totalComments = posts.reduce((sum, p) => sum + p._count.comments, 0);
    const totalReactions = posts.reduce((sum, p) => sum + p._count.reactions, 0);

    return {
      totalPosts: posts.length,
      totalViews,
      totalFollowers: followersCount,
      totalComments,
      totalReactions,
      topPosts: posts.slice(0, 5),
    };
  }

  async getTrendingPosts(limit = 10) {
    try {
      const topIds = await redis.zrevrange("blog:trending:daily", 0, limit - 1);
      if (topIds.length === 0) {
        return prisma.post.findMany({
          where: { status: "PUBLISHED", deletedAt: null },
          orderBy: { viewCount: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            viewCount: true,
            author: { select: { firstName: true, lastName: true } },
          },
        });
      }

      const posts = await prisma.post.findMany({
        where: { id: { in: topIds }, status: "PUBLISHED", deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          viewCount: true,
          author: { select: { firstName: true, lastName: true } },
        },
      });

      return topIds.map((id) => posts.find((p) => p.id === id)).filter(Boolean);
    } catch {
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();
