import type { Request, Response } from "express";
import { bookmarksService } from "./bookmarks.service.js";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const toggleBookmark = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const result = await bookmarksService.toggleBookmark(
    postId,
    req.user!.id
  );
  res.status(200).json({ status: "success", data: result });
};

export const getUserBookmarks = async (req: Request, res: Response): Promise<void> => {
  const { cursor, limit } = paginationQuerySchema.parse(req.query);
  const result = await bookmarksService.getUserBookmarks(req.user!.id, cursor, limit);
  res.status(200).json({ status: "success", ...result });
};
