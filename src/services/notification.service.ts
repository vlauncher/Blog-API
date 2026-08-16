import { EventEmitter } from "node:events";
import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";

export const notificationEmitter = new EventEmitter();

export interface CreateNotificationPayload {
  userId: string;
  actorId?: string;
  type:
    | "NEW_FOLLOWER"
    | "COMMENT"
    | "REACTION"
    | "POST_PUBLISHED"
    | "POST_PENDING_REVIEW"
    | "POST_APPROVED"
    | "POST_REJECTED"
    | "SYSTEM";
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

  static async notifyAdminsForReview(post: { id: string; title: string; slug: string; excerpt?: string | null; authorId: string }) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, email: true, firstName: true },
      });

      const author = await prisma.user.findUnique({
        where: { id: post.authorId },
        select: { firstName: true, lastName: true, email: true },
      });

      const authorName = author ? `${author.firstName} ${author.lastName}` : "Community Member";

      // 1. Send in-app SSE notification to all admins
      await Promise.all(
        admins.map((admin) =>
          this.send({
            userId: admin.id,
            actorId: post.authorId,
            type: "POST_PENDING_REVIEW",
            message: `New community submission awaiting your review: "${post.title}" by ${authorName}`,
            data: { postId: post.id, postSlug: post.slug, postTitle: post.title },
          })
        )
      );

      // 2. Send email to admins
      const { sendMail } = await import("../config/mailer.js");
      for (const admin of admins) {
        try {
          await sendMail({
            to: admin.email,
            subject: `[Review Needed] New Story Submission: "${post.title}"`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
                <div style="background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%); padding: 24px; border-radius: 16px; color: white; margin-bottom: 24px;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 700;">AetherBlog Editorial Review</h1>
                  <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Community Contribution Awaiting Admin Approval</p>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                  <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">${post.title}</h2>
                  <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">Submitted by <strong>${authorName}</strong> (${author?.email})</p>
                  ${post.excerpt ? `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #334155; font-style: italic;">"${post.excerpt}"</p>` : ""}
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                  Please log into the Admin Dashboard or visit the post moderation queue to review and publish this story.
                </p>
                <div style="margin-top: 24px; text-align: center;">
                  <a href="http://localhost:3000/analytics" style="display: inline-block; background: #0284c7; color: white; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 9999px; text-decoration: none; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
                    Review in Moderation Queue →
                  </a>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center;">AetherBlog Automated Editorial Notifications</p>
              </div>
            `,
          });
        } catch (mailErr) {
          logger.warn({ mailErr, adminEmail: admin.email }, "Could not send admin review email");
        }
      }
    } catch (err) {
      logger.error({ err, postId: post.id }, "Failed to notify admins of pending post");
    }
  }

  static async notifyAuthorPostApproved(authorId: string, postTitle: string, postSlug: string) {
    try {
      await this.send({
        userId: authorId,
        type: "POST_APPROVED",
        message: `🎉 Great news! Your story "${postTitle}" was approved and is now live!`,
        data: { postSlug, postTitle },
      });
    } catch (err) {
      logger.error({ err, authorId }, "Failed to notify author of post approval");
    }
  }
}
