import type { Request, Response } from "express";
import { categoriesService } from "./categories.service.js";
import { createCategorySchema, updateCategorySchema } from "./categories.schema.js";

export const getCategoryTree = async (_req: Request, res: Response): Promise<void> => {
  const categories = await categoriesService.getCategoryTree();
  res.status(200).json({ status: "success", data: categories });
};

export const getCategoryBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug);
  const category = await categoriesService.getCategoryBySlug(slug);
  res.status(200).json({ status: "success", data: category });
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const validated = createCategorySchema.parse(req.body);
  const category = await categoriesService.createCategory(validated);
  res.status(201).json({ status: "success", data: category });
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validated = updateCategorySchema.parse(req.body);
  const category = await categoriesService.updateCategory(id, validated);
  res.status(200).json({ status: "success", data: category });
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await categoriesService.deleteCategory(id);
  res.status(200).json({ status: "success", ...result });
};
