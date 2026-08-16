import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(2).max(50).trim(),
  description: z.string().max(300).trim().optional(),
  parentId: z.string().optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(50).trim().optional(),
  description: z.string().max(300).trim().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
