import type { Request, Response } from "express";
import { tagsService } from "./tags.service.js";
import { createTagSchema, updateTagSchema } from "./tags.schema.js";

export const getTags = async (_req: Request, res: Response): Promise<void> => {
  const tags = await tagsService.getTags();
  res.status(200).json({ status: "success", data: tags });
};

export const getTagBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug);
  const tag = await tagsService.getTagBySlug(slug);
  res.status(200).json({ status: "success", data: tag });
};

export const createTag = async (req: Request, res: Response): Promise<void> => {
  const validated = createTagSchema.parse(req.body);
  const tag = await tagsService.createTag(validated);
  res.status(201).json({ status: "success", data: tag });
};

export const updateTag = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validated = updateTagSchema.parse(req.body);
  const tag = await tagsService.updateTag(id, validated);
  res.status(200).json({ status: "success", data: tag });
};

export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await tagsService.deleteTag(id);
  res.status(200).json({ status: "success", ...result });
};
