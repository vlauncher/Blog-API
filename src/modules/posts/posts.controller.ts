import type { Request, Response } from "express";
import { postsService } from "./posts.service.js";
import {
  createPostSchema,
  updatePostSchema,
  schedulePostSchema,
  queryPostsSchema,
} from "./posts.schema.js";

export const createPost = async (req: Request, res: Response): Promise<void> => {
  const validated = createPostSchema.parse(req.body);
  const post = await postsService.createPost(
    req.user!.id,
    req.user!.role || "READER",
    validated
  );
  res.status(201).json({ status: "success", data: post });
};

export const getPosts = async (req: Request, res: Response): Promise<void> => {
  const validated = queryPostsSchema.parse(req.query);
  const result = await postsService.getPosts(validated);
  res.status(200).json({ status: "success", ...result });
};

export const getPostBySlug = async (req: Request, res: Response): Promise<void> => {
  const slug = String(req.params.slug);
  const post = await postsService.getPostBySlug(slug, req.user?.id);
  res.status(200).json({ status: "success", data: post });
};

export const getPostById = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const post = await postsService.getPostById(id);
  res.status(200).json({ status: "success", data: post });
};

export const updatePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const validated = updatePostSchema.parse(req.body);
  const post = await postsService.updatePost(
    id,
    req.user!.id,
    req.user!.role || "READER",
    validated
  );
  res.status(200).json({ status: "success", data: post });
};

export const publishPost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const post = await postsService.publishPost(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: post });
};

export const approvePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const post = await postsService.approvePost(id, req.user!.id);
  res.status(200).json({ status: "success", data: post });
};

export const rejectPost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { reason } = req.body || {};
  const post = await postsService.rejectPost(id, req.user!.id, reason);
  res.status(200).json({ status: "success", data: post });
};

export const getPendingPosts = async (_req: Request, res: Response): Promise<void> => {
  const posts = await postsService.getPendingReviewPosts();
  res.status(200).json({ status: "success", data: posts });
};

export const schedulePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { scheduledPublishAt } = schedulePostSchema.parse(req.body);
  const post = await postsService.schedulePost(
    id,
    req.user!.id,
    req.user!.role || "READER",
    scheduledPublishAt
  );
  res.status(200).json({ status: "success", data: post });
};

export const archivePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const post = await postsService.archivePost(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: post });
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await postsService.deletePost(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", ...result });
};

export const restorePost = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const post = await postsService.restorePost(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: post });
};

export const getRevisions = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const revisions = await postsService.getRevisions(
    id,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: revisions });
};

export const restoreRevision = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const revisionId = String(req.params.revisionId);
  const post = await postsService.restoreRevision(
    id,
    revisionId,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: post });
};
