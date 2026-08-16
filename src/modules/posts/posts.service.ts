import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateUniqueSlug } from "../../utils/slug.js";
import {
  renderMarkdownToHtml,
  extractTableOfContents,
  extractExcerpt,
} from "../../utils/markdown.js";
import { calculateReadingStats } from "../../utils/reading-time.js";
import { buildPaginatedResponse } from "../../utils/pagination.js";
import { CacheService } from "../../services/cache.service.js";
import { NotificationService } from "../../services/notification.service.js";
import { tagsService } from "../tags/tags.service.js";
import type {
  CreatePostInput,
  UpdatePostInput,
  QueryPostsInput,
} from "./posts.schema.js";

export class PostsService {
  private async syncTags(postId: string, tagNames: string[]) {
    // 1. Remove existing post-tag links
    await prisma.postTag.deleteMany({ where: { postId } });

    if (!tagNames || tagNames.length === 0) return;

    // 2. Ensure each tag exists
    for (const rawName of tagNames) {
      const name = rawName.trim();
      if (!name) continue;

      const tag = await tagsService.createTag({ name });
      await prisma.postTag.upsert({
        where: { postId_tagId: { postId, tagId: tag.id } },
        create: { postId, tagId: tag.id },
        update: {},
      });
    }
  }

  async createPost(userId: string, input: CreatePostInput) {
    const slug = await generateUniqueSlug(input.title, async (s) => {
      const found = await prisma.post.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    const contentHtml = await renderMarkdownToHtml(input.content);
    const readingStats = calculateReadingStats(input.content);
    const excerpt = input.excerpt || extractExcerpt(input.content);

    const isPublished = input.status === "PUBLISHED";
    const publishedAt = isPublished ? new Date() : null;
    const scheduledPublishAt = input.scheduledPublishAt
      ? new Date(input.scheduledPublishAt)
      : null;

    const post = await prisma.post.create({
      data: {
        title: input.title,
        slug,
        content: input.content,
        contentHtml,
        excerpt,
        coverImage: input.coverImage,
        coverImageId: input.coverImageId,
        status: input.status || "DRAFT",
        readingTimeMinutes: readingStats.readingTimeMinutes,
        wordCount: readingStats.wordCount,
        metaTitle: input.metaTitle || input.title,
        metaDescription: input.metaDescription || excerpt,
        canonicalUrl: input.canonicalUrl,
        ogImage: input.ogImage || input.coverImage,
        publishedAt,
        scheduledPublishAt,
        authorId: userId,
        categoryId: input.categoryId,
      },
    });

    // Create Initial Revision (Version 1)
    await prisma.postRevision.create({
      data: {
        postId: post.id,
        editorId: userId,
        version: 1,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
      },
    });

    // Sync tags
    if (input.tags && input.tags.length > 0) {
      await this.syncTags(post.id, input.tags);
    }

    // Invalidate caches
    await CacheService.invalidatePostCaches(post.slug, post.id);

    // Notify followers if published immediately
    if (isPublished) {
      await NotificationService.notifyFollowers(userId, post.title, post.slug);
    }

    return this.getPostById(post.id);
  }

  async getPosts(query: QueryPostsInput) {
    const limit = query.limit;
    const cursor = query.cursor;

    const where: any = {
      deletedAt: null,
    };

    // Default to published posts for public view
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = "PUBLISHED";
    }

    if (query.authorId) {
      where.authorId = query.authorId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    if (query.tag) {
      where.tags = {
        some: {
          tag: {
            slug: query.tag.toLowerCase(),
          },
        },
      };
    }

    let orderBy: any = [{ createdAt: "desc" }, { id: "desc" }];
    if (query.sort === "oldest") {
      orderBy = [{ createdAt: "asc" }, { id: "asc" }];
    } else if (query.sort === "popular") {
      orderBy = [{ viewCount: "desc" }, { id: "desc" }];
    }

    const posts = await prisma.post.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        status: true,
        readingTimeMinutes: true,
        wordCount: true,
        viewCount: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                bio: true,
                profilePicture: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            reactions: true,
            bookmarks: true,
          },
        },
      },
    });

    const transformed = posts.map((post) => ({
      ...post,
      tags: post.tags.map((t) => t.tag),
    }));

    return buildPaginatedResponse(transformed, limit);
  }

  async getPostBySlug(slug: string, currentUserId?: string) {
    const post = await prisma.post.findUnique({
      where: { slug, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: {
              select: {
                bio: true,
                profilePicture: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        reactions: {
          select: {
            type: true,
            userId: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reactions: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    // Reaction counts breakdown
    const reactionCounts: Record<string, number> = {};
    post.reactions.forEach((r) => {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    });

    let userReaction: string | null = null;
    let isBookmarked = false;

    if (currentUserId) {
      const foundReaction = post.reactions.find((r) => r.userId === currentUserId);
      userReaction = foundReaction ? foundReaction.type : null;

      const bookmark = await prisma.bookmark.findUnique({
        where: { postId_userId: { postId: post.id, userId: currentUserId } },
      });
      isBookmarked = Boolean(bookmark);
    }

    const tableOfContents = extractTableOfContents(post.content);

    return {
      ...post,
      reactions: undefined, // Omit raw reactions array
      reactionCounts,
      userReaction,
      isBookmarked,
      tableOfContents,
      tags: post.tags.map((t) => t.tag),
    };
  }

  async getPostById(id: string) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profile: { select: { profilePicture: true } },
          },
        },
        category: true,
        tags: {
          select: { tag: true },
        },
        _count: {
          select: { comments: true, reactions: true, revisions: true },
        },
      },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    return {
      ...post,
      tags: post.tags.map((t) => t.tag),
    };
  }

  async updatePost(id: string, userId: string, userRole: string, input: UpdatePostInput) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to edit this post", 403);
    }

    let slug = post.slug;
    if (input.title && input.title !== post.title) {
      slug = await generateUniqueSlug(input.title, async (s) => {
        const found = await prisma.post.findUnique({ where: { slug: s } });
        return Boolean(found && found.id !== id);
      });
    }

    const content = input.content ?? post.content;
    const contentHtml = input.content ? await renderMarkdownToHtml(input.content) : post.contentHtml;
    const readingStats = input.content ? calculateReadingStats(input.content) : null;
    const excerpt = input.excerpt !== undefined ? input.excerpt : (input.content ? extractExcerpt(input.content) : post.excerpt);

    // Save previous version to PostRevision if content or title changed
    if ((input.title && input.title !== post.title) || (input.content && input.content !== post.content)) {
      const lastRevision = await prisma.postRevision.findFirst({
        where: { postId: id },
        orderBy: { version: "desc" },
      });
      const nextVersion = (lastRevision?.version ?? 0) + 1;

      await prisma.postRevision.create({
        data: {
          postId: id,
          editorId: userId,
          version: nextVersion,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
        },
      });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(input.title && { title: input.title, slug }),
        ...(input.content && {
          content,
          contentHtml,
          readingTimeMinutes: readingStats?.readingTimeMinutes,
          wordCount: readingStats?.wordCount,
        }),
        ...(excerpt !== undefined && { excerpt }),
        ...(input.coverImage !== undefined && { coverImage: input.coverImage }),
        ...(input.coverImageId !== undefined && { coverImageId: input.coverImageId }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
        ...(input.status && { status: input.status }),
        ...(input.scheduledPublishAt !== undefined && {
          scheduledPublishAt: input.scheduledPublishAt ? new Date(input.scheduledPublishAt) : null,
        }),
        ...(input.metaTitle !== undefined && { metaTitle: input.metaTitle }),
        ...(input.metaDescription !== undefined && { metaDescription: input.metaDescription }),
        ...(input.canonicalUrl !== undefined && { canonicalUrl: input.canonicalUrl }),
        ...(input.ogImage !== undefined && { ogImage: input.ogImage }),
      },
    });

    if (input.tags) {
      await this.syncTags(id, input.tags);
    }

    await CacheService.invalidatePostCaches(post.slug, id);
    if (slug !== post.slug) {
      await CacheService.invalidatePostCaches(slug, id);
    }

    return this.getPostById(updated.id);
  }

  async publishPost(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to publish this post", 403);
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        scheduledPublishAt: null,
      },
    });

    await CacheService.invalidatePostCaches(post.slug, id);
    await NotificationService.notifyFollowers(post.authorId, post.title, post.slug);

    return updated;
  }

  async schedulePost(id: string, userId: string, userRole: string, scheduledDateStr: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to schedule this post", 403);
    }

    const scheduledDate = new Date(scheduledDateStr);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      throw new AppError("Scheduled date must be in the future", 400);
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        scheduledPublishAt: scheduledDate,
      },
    });

    await CacheService.invalidatePostCaches(post.slug, id);
    return updated;
  }

  async archivePost(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to archive this post", 403);
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await CacheService.invalidatePostCaches(post.slug, id);
    return updated;
  }

  async deletePost(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to delete this post", 403);
    }

    if (post.deletedAt) {
      // Permanent delete if already soft deleted
      await prisma.post.delete({ where: { id } });
    } else {
      // Soft delete
      await prisma.post.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    await CacheService.invalidatePostCaches(post.slug, id);
    return { message: "Post deleted successfully" };
  }

  async restorePost(id: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to restore this post", 403);
    }

    const restored = await prisma.post.update({
      where: { id },
      data: { deletedAt: null },
    });

    await CacheService.invalidatePostCaches(post.slug, id);
    return restored;
  }

  async getRevisions(postId: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("Forbidden", 403);
    }

    const revisions = await prisma.postRevision.findMany({
      where: { postId },
      include: {
        editor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { version: "desc" },
    });

    return revisions;
  }

  async restoreRevision(postId: string, revisionId: string, userId: string, userRole: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("Forbidden", 403);
    }

    const revision = await prisma.postRevision.findUnique({
      where: { id: revisionId },
    });

    if (!revision || revision.postId !== postId) {
      throw new AppError("Revision not found", 404);
    }

    return this.updatePost(postId, userId, userRole, {
      title: revision.title,
      content: revision.content,
      excerpt: revision.excerpt,
    });
  }
}

export const postsService = new PostsService();
