import type { Request, Response } from "express";
import { analyticsService } from "./analytics.service.js";
import { z } from "zod";

const recordViewSchema = z.object({
  readPercent: z.number().min(0).max(100).optional(),
  referrer: z.string().optional(),
});

export const recordView = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const { readPercent, referrer } = recordViewSchema.parse(req.body);
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = req.headers["user-agent"] || "unknown";

  const result = await analyticsService.recordView(
    postId,
    ip,
    userAgent,
    readPercent,
    referrer
  );

  res.status(200).json({ status: "success", ...result });
};

export const getPostAnalytics = async (req: Request, res: Response): Promise<void> => {
  const postId = String(req.params.postId);
  const result = await analyticsService.getPostAnalytics(
    postId,
    req.user!.id,
    req.user!.role || "READER"
  );
  res.status(200).json({ status: "success", data: result });
};

export const getAuthorDashboard = async (req: Request, res: Response): Promise<void> => {
  const result = await analyticsService.getAuthorDashboard(req.user!.id);
  res.status(200).json({ status: "success", data: result });
};

export const getTrendingPosts = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
  const result = await analyticsService.getTrendingPosts(limit);
  res.status(200).json({ status: "success", data: result });
};
