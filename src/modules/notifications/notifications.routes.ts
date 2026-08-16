import { Router } from "express";
import {
  streamNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "./notifications.controller.js";
import { authenticate } from "../../middleware/auth.js";

const router = Router();

// All notifications endpoints require authentication
router.use(authenticate);

/**
 * @openapi
 * /api/notifications/stream:
 *   get:
 *     summary: Real-time Server-Sent Events (SSE) stream for instant notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: EventSource stream
 */
router.get("/stream", streamNotifications);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

export default router;
