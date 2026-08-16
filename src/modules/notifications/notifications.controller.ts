import type { Request, Response } from "express";
import { notificationsModuleService } from "./notifications.service.js";
import { notificationEmitter } from "../../services/notification.service.js";
import { paginationQuerySchema } from "../../utils/pagination.js";

export const streamNotifications = (req: Request, res: Response): void => {
  const userId = req.user!.id;

  // Set SSE Headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ event: "connected", message: "SSE connected successfully" })}\n\n`);

  const onNotification = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const channel = `user:${userId}`;
  notificationEmitter.on(channel, onNotification);

  // 30s heartbeat ping
  const interval = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 30000);

  req.on("close", () => {
    clearInterval(interval);
    notificationEmitter.off(channel, onNotification);
    res.end();
  });
};

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const { cursor, limit } = paginationQuerySchema.parse(req.query);
  const result = await notificationsModuleService.getUserNotifications(req.user!.id, cursor, limit);
  res.status(200).json({ status: "success", ...result });
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const result = await notificationsModuleService.markAsRead(id, req.user!.id);
  res.status(200).json({ status: "success", data: result });
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  const result = await notificationsModuleService.markAllAsRead(req.user!.id);
  res.status(200).json({ status: "success", ...result });
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  const result = await notificationsModuleService.getUnreadCount(req.user!.id);
  res.status(200).json({ status: "success", data: result });
};
