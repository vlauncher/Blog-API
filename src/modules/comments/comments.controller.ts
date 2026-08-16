import type { Request, Response } from "express";
import { commentsService } from "./comments.service.js";
import { createCommentSchema, updateCommentSchema } from "./comments.schema.js";

export const getPostComments = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const comments = await commentsService.getPostComments(postId);
  res.status(200).json({ status: "success", data: comments });
};

export const createComment = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const validated = createCommentSchema.parse(req.body);
  const comment = await commentsService.createComment(
    postId,
    req.user!.id,
    validated
  );
  res.status(201).json({ status: "success", data: comment });
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validated = updateCommentSchema.parse(req.body);
  const comment = await commentsService.updateComment(
    id,
    req.user!.id,
    req.user!.role || "READER",
    validated
  );
  res.status(200).json({ status: "success", data: comment });
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await commentsService.deleteComment(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", ...result });
};
