import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { sanitizeContent } from "../../utils/markdown.js";
import { NotificationService } from "../../services/notification.service.js";
import type { CreateCommentInput, UpdateCommentInput } from "./comments.schema.js";

export class CommentsService {
  async getPostComments(postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const comments = await prisma.comment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
      },
    });

    // Build threaded tree
    const map = new Map<string, any>();
    comments.forEach((c) => {
      map.set(c.id, { ...c, replies: [] });
    });

    const rootComments: any[] = [];
    comments.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId).replies.push(map.get(c.id));
      } else {
        rootComments.push(map.get(c.id));
      }
    });

    return rootComments;
  }

  async createComment(postId: string, userId: string, input: CreateCommentInput) {
    const post = await prisma.post.findUnique({
      where: { id: postId, status: "PUBLISHED", deletedAt: null },
    });

    if (!post) {
      throw new AppError("Post not found or not published", 404);
    }

    let parentAuthorId: string | null = null;
    if (input.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: input.parentId, postId, deletedAt: null },
      });
      if (!parent) {
        throw new AppError("Parent comment not found", 404);
      }
      parentAuthorId = parent.authorId;
    }

    const sanitizedContent = sanitizeContent(input.content);

    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        parentId: input.parentId,
        content: sanitizedContent,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
      },
    });

    // Notify post author (if not self)
    if (post.authorId !== userId) {
      const commenterName = `${comment.author.firstName} ${comment.author.lastName}`;
      await NotificationService.send({
        userId: post.authorId,
        actorId: userId,
        type: "COMMENT",
        message: `${commenterName} commented on your post "${post.title}"`,
        data: { postId, postSlug: post.slug, commentId: comment.id },
      });
    }

    // If reply to someone else's comment, notify parent comment author
    if (parentAuthorId && parentAuthorId !== userId && parentAuthorId !== post.authorId) {
      const commenterName = `${comment.author.firstName} ${comment.author.lastName}`;
      await NotificationService.send({
        userId: parentAuthorId,
        actorId: userId,
        type: "COMMENT",
        message: `${commenterName} replied to your comment on "${post.title}"`,
        data: { postId, postSlug: post.slug, commentId: comment.id },
      });
    }

    return comment;
  }

  async updateComment(id: string, userId: string, userRole: string, input: UpdateCommentInput) {
    const comment = await prisma.comment.findUnique({ where: { id, deletedAt: null } });
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to edit this comment", 403);
    }

    const sanitized = sanitizeContent(input.content);

    const updated = await prisma.comment.update({
      where: { id },
      data: {
        content: sanitized,
        isEdited: true,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
      },
    });

    return updated;
  }

  async deleteComment(id: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUnique({ where: { id, deletedAt: null } });
    if (!comment) {
      throw new AppError("Comment not found", 404);
    }

    if (comment.authorId !== userId && userRole !== "ADMIN") {
      throw new AppError("You do not have permission to delete this comment", 403);
    }

    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: "Comment deleted successfully" };
  }
}

export const commentsService = new CommentsService();
