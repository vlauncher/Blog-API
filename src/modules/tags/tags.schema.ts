import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(2).max(30).trim(),
});

export const updateTagSchema = z.object({
  name: z.string().min(2).max(30).trim(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
