import { Router } from "express";
import {
  createWebhook,
  getUserWebhooks,
  deleteWebhook,
} from "./webhooks.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

// Webhook management requires authentication and Author/Admin role
router.use(authenticate, requireRole("AUTHOR", "ADMIN"));

/**
 * @openapi
 * /api/webhooks:
 *   get:
 *     summary: List user's registered webhooks
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of registered webhooks
 *   post:
 *     summary: Register a new webhook endpoint
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, secret, events]
 *             properties:
 *               url:
 *                 type: string
 *               secret:
 *                 type: string
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [post.published, post.updated, comment.created, subscriber.confirmed]
 *     responses:
 *       201:
 *         description: Webhook registered
 */
router.get("/", getUserWebhooks);
router.post("/", writeLimiter, createWebhook);
router.delete("/:id", deleteWebhook);

export default router;
