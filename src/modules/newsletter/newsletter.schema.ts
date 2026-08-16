import { z } from "zod";

export const subscribeNewsletterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;
