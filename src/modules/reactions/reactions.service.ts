import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { NotificationService } from "../../services/notification.service.js";
import type { ToggleReactionInput } from "./reactions.schema.js";

export class ReactionsService {
  async toggleReaction(postId: string, userId: string, input: ToggleReactionInput) {
    const post = await prisma.post.findUnique({
      where: { id: postId, status: "PUBLISHED", deletedAt: null },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const existing = await prisma.reaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type: input.type,
        },
      },
    });

    if (existing) {
      // Remove reaction (un-react)
      await prisma.reaction.delete({ where: { id: existing.id } });
      return { action: "removed", type: input.type };
    }

    // Add reaction
    const reaction = await prisma.reaction.create({
      data: {
        postId,
        userId,
        type: input.type,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    // Notify author if not self
    if (post.authorId !== userId) {
      const actorName = `${reaction.user.firstName} ${reaction.user.lastName}`;
      await NotificationService.send({
        userId: post.authorId,
        actorId: userId,
        type: "REACTION",
        message: `${actorName} reacted (${input.type}) to your post "${post.title}"`,
        data: { postId, postSlug: post.slug, reactionType: input.type },
      });
    }

    return { action: "added", type: input.type };
  }

  async getPostReactions(postId: string, userId?: string) {
    const reactions = await prisma.reaction.findMany({
      where: { postId },
      select: { type: true, userId: true },
    });

    const counts: Record<string, number> = {};
    reactions.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });

    let userReaction: string | null = null;
    if (userId) {
      const match = reactions.find((r) => r.userId === userId);
      userReaction = match ? match.type : null;
    }

    return {
      total: reactions.length,
      counts,
      userReaction,
    };
  }
}

export const reactionsService = new ReactionsService();
