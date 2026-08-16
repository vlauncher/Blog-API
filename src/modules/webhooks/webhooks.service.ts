import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
import type { CreateWebhookInput } from "./webhooks.schema.js";

export class WebhooksService {
  async createWebhook(userId: string, input: CreateWebhookInput) {
    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url: input.url,
        secret: input.secret,
        events: JSON.stringify(input.events),
      },
    });

    return {
      ...webhook,
      events: JSON.parse(webhook.events),
    };
  }

  async getUserWebhooks(userId: string) {
    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return webhooks.map((w) => ({
      ...w,
      events: JSON.parse(w.events),
    }));
  }

  async deleteWebhook(id: string, userId: string) {
    const webhook = await prisma.webhook.findUnique({ where: { id } });
    if (!webhook || webhook.userId !== userId) {
      throw new AppError("Webhook not found", 404);
    }

    await prisma.webhook.delete({ where: { id } });
    return { message: "Webhook deleted successfully" };
  }

  static async dispatchEvent(event: string, payload: Record<string, unknown>) {
    try {
      const allWebhooks = await prisma.webhook.findMany({
        where: { isActive: true },
      });

      const matching = allWebhooks.filter((w) => {
        try {
          const events: string[] = JSON.parse(w.events);
          return events.includes(event);
        } catch {
          return false;
        }
      });

      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      await Promise.allSettled(
        matching.map(async (w) => {
          const signature = crypto
            .createHmac("sha256", w.secret)
            .update(body)
            .digest("hex");

          try {
            await fetch(w.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Blog-Event": event,
                "X-Blog-Signature": signature,
                "User-Agent": "Blog-API-Webhook/1.0",
              },
              body,
              signal: AbortSignal.timeout(5000), // 5s timeout
            });
          } catch (err) {
            logger.warn({ err, webhookId: w.id, url: w.url }, "Webhook dispatch failed");
          }
        })
      );
    } catch (err) {
      logger.error({ err, event }, "Failed to process webhook events");
    }
  }
}

export const webhooksService = new WebhooksService();
