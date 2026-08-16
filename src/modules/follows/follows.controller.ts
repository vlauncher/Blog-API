import type { Request, Response } from "express";
import { followsService } from "./follows.service.js";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const toggleFollow = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const result = await followsService.toggleFollow(
    req.user!.id,
    userId
  );
  res.status(200).json({ status: "success", data: result });
};

export const getFollowers = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const { cursor, limit } = paginationQuerySchema.parse(req.query);
  const result = await followsService.getFollowers(userId, cursor, limit);
  res.status(200).json({ status: "success", ...result });
};

export const getFollowing = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);
  const { cursor, limit } = paginationQuerySchema.parse(req.query);
  const result = await followsService.getFollowing(userId, cursor, limit);
  res.status(200).json({ status: "success", ...result });
};
