import type { Request, Response } from "express";
import { reactionsService } from "./reactions.service.js";
import { toggleReactionSchema } from "./reactions.schema.js";

export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const validated = toggleReactionSchema.parse(req.body);
  const result = await reactionsService.toggleReaction(
    postId,
    req.user!.id,
    validated
  );
  res.status(200).json({ status: "success", data: result });
};

export const getPostReactions = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const result = await reactionsService.getPostReactions(
    postId,
    req.user?.id
  );
  res.status(200).json({ status: "success", data: result });
};
