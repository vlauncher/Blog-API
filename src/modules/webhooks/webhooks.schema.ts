import { z } from "zod";

export const webhookEventsEnum = z.enum([
  "post.published",
  "post.updated",
  "comment.created",
  "subscriber.confirmed",
]);

export const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).max(64),
  events: z.array(webhookEventsEnum).min(1),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
