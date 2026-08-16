import type { Request, Response } from "express";
import { webhooksService } from "./webhooks.service.js";
import { createWebhookSchema } from "./webhooks.schema.js";

export const createWebhook = async (req: Request, res: Response): Promise<void> => {
  const validated = createWebhookSchema.parse(req.body);
  const webhook = await webhooksService.createWebhook(req.user!.id, validated);
  res.status(201).json({ status: "success", data: webhook });
};

export const getUserWebhooks = async (req: Request, res: Response): Promise<void> => {
  const webhooks = await webhooksService.getUserWebhooks(req.user!.id);
  res.status(200).json({ status: "success", data: webhooks });
};

export const deleteWebhook = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await webhooksService.deleteWebhook(id, req.user!.id);
  res.status(200).json({ status: "success", ...result });
};
