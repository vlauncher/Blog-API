import { EventEmitter } from "node:events";
import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";

export const notificationEmitter = new EventEmitter();

export interface CreateNotificationPayload {
  userId: string;
  actorId?: string;
  type: "NEW_FOLLOWER" | "COMMENT" | "REACTION" | "POST_PUBLISHED" | "SYSTEM";
  message: string;
  data?: Record<string, unknown>;
}

export class NotificationService {
  static async send(payload: CreateNotificationPayload) {
    try {
      // Don't notify oneself
      if (payload.actorId && payload.actorId === payload.userId) {
        return;
      }

      const notification = await prisma.notification.create({
        data: {
          userId: payload.userId,
          actorId: payload.actorId,
          type: payload.type,
          message: payload.message,
          data: payload.data ? JSON.stringify(payload.data) : null,
        },
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profile: { select: { profilePicture: true } },
            },
          },
        },
      });

      // Emit real-time SSE event to active subscriber channel
      notificationEmitter.emit(`user:${payload.userId}`, notification);

      return notification;
    } catch (err) {
      logger.error({ err, payload }, "Failed to send notification");
    }
  }

  static async notifyFollowers(authorId: string, postTitle: string, postSlug: string) {
    try {
      const followers = await prisma.follow.findMany({
        where: { followingId: authorId },
        select: { followerId: true },
      });

      const author = await prisma.user.findUnique({
        where: { id: authorId },
        select: { firstName: true, lastName: true },
      });

      const authorName = author ? `${author.firstName} ${author.lastName}` : "An author you follow";

      await Promise.all(
        followers.map((f) =>
          this.send({
            userId: f.followerId,
            actorId: authorId,
            type: "POST_PUBLISHED",
            message: `${authorName} published a new post: "${postTitle}"`,
            data: { postSlug, postTitle },
          })
        )
      );
    } catch (err) {
      logger.error({ err, authorId }, "Failed to notify followers of new post");
    }
  }
}
