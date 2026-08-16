import type { Request, Response } from "express";
import { searchService } from "./search.service.js";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().default(""),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["all", "posts", "authors", "tags"]).default("all"),
});

export const search = async (req: Request, res: Response): Promise<void> => {
  const validated = searchQuerySchema.parse(req.query);
  const results = await searchService.search(validated);
  res.status(200).json({ status: "success", ...results });
};
