import { z } from "zod";

export const postStatusEnum = z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"]);

export const createPostSchema = z.object({
  title: z.string().min(3).max(250).trim(),
  content: z.string().min(10), // Markdown content
  excerpt: z.string().max(500).trim().optional(),
  coverImage: z.string().url().optional().nullable(),
  coverImageId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1).max(30).trim()).max(10).optional().default([]),
  status: postStatusEnum.optional().default("DRAFT"),
  scheduledPublishAt: z.string().datetime().optional().nullable(),

  // SEO metadata
  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  canonicalUrl: z.string().url().optional().nullable(),
  ogImage: z.string().url().optional().nullable(),
});

export const updatePostSchema = z.object({
  title: z.string().min(3).max(250).trim().optional(),
  content: z.string().min(10).optional(),
  excerpt: z.string().max(500).trim().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  coverImageId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1).max(30).trim()).max(10).optional(),
  status: postStatusEnum.optional(),
  scheduledPublishAt: z.string().datetime().optional().nullable(),

  metaTitle: z.string().max(100).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  canonicalUrl: z.string().url().optional().nullable(),
  ogImage: z.string().url().optional().nullable(),
});

export const schedulePostSchema = z.object({
  scheduledPublishAt: z.string().datetime(),
});

export const queryPostsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
  tag: z.string().optional(),
  authorId: z.string().optional(),
  status: postStatusEnum.optional(),
  sort: z.enum(["newest", "oldest", "popular"]).default("newest"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
export type QueryPostsInput = z.infer<typeof queryPostsSchema>;
