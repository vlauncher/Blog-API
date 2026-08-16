import { z } from "zod";

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  parentId: z.string().optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
