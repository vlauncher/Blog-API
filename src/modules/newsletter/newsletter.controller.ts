import type { Request, Response } from "express";
import { newsletterService } from "./newsletter.service.js";
import { subscribeNewsletterSchema } from "./newsletter.schema.js";

export const subscribe = async (req: Request, res: Response): Promise<void> => {
  const { email } = subscribeNewsletterSchema.parse(req.body);
  const result = await newsletterService.subscribe(email, req.user?.id);
  res.status(200).json({ status: "success", ...result });
};

export const confirmSubscription = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token);
  const result = await newsletterService.confirmSubscription(token);
  res.status(200).json({ status: "success", ...result });
};

export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
  const token = String(req.params.token);
  const result = await newsletterService.unsubscribe(token);
  res.status(200).json({ status: "success", ...result });
};

export const getSubscribers = async (_req: Request, res: Response): Promise<void> => {
  const subscribers = await newsletterService.getSubscribers();
  res.status(200).json({ status: "success", data: subscribers });
};
