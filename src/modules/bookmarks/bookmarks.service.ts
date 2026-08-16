import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildPaginatedResponse } from "../../utils/pagination.js";

export class BookmarksService {
  async toggleBookmark(postId: string, userId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const existing = await prisma.bookmark.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return { isBookmarked: false };
    }

    await prisma.bookmark.create({
      data: { postId, userId },
    });

    return { isBookmarked: true };
  }

  async getUserBookmarks(userId: string, cursor?: string, limit = 20) {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            readingTimeMinutes: true,
            publishedAt: true,
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profile: { select: { profilePicture: true } },
              },
            },
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return buildPaginatedResponse(bookmarks, limit);
  }
}

export const bookmarksService = new BookmarksService();
