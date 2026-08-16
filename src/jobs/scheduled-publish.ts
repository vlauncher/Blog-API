import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "../config/prisma.js";
import { CacheService } from "../services/cache.service.js";
import { NotificationService } from "../services/notification.service.js";
import { WebhooksService } from "../modules/webhooks/webhooks.service.js";
import { logger } from "../utils/logger.js";

let task: ScheduledTask | null = null;

export const initScheduledPublishJob = (): ScheduledTask => {
  // Run every minute: * * * * *
  task = cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const scheduledPosts = await prisma.post.findMany({
        where: {
          status: "SCHEDULED",
          scheduledPublishAt: { lte: now },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          authorId: true,
        },
      });

      if (scheduledPosts.length === 0) return;

      logger.info({ count: scheduledPosts.length }, "Publishing scheduled posts...");

      const ids = scheduledPosts.map((p) => p.id);

      await prisma.post.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          scheduledPublishAt: null,
        },
      });

      for (const post of scheduledPosts) {
        await CacheService.invalidatePostCaches(post.slug, post.id);
        await NotificationService.notifyFollowers(post.authorId, post.title, post.slug);
        await WebhooksService.dispatchEvent("post.published", {
          postId: post.id,
          title: post.title,
          slug: post.slug,
          publishedAt: now.toISOString(),
        });
      }

      logger.info(`Successfully published ${scheduledPosts.length} scheduled posts.`);
    } catch (error) {
      logger.error({ error }, "Error during scheduled post publishing job");
    }
  });

  return task;
};

export const stopScheduledPublishJob = (): void => {
  if (task) {
    task.stop();
    task = null;
  }
};
