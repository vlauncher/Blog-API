import { Router } from "express";
import { toggleReaction, getPostReactions } from "./reactions.controller.js";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/reactions/post/{postId}:
 *   get:
 *     summary: Get reactions count and user's reaction for a post
 *     tags: [Reactions]
 *     responses:
 *       200:
 *         description: Reaction summary
 *   post:
 *     summary: Toggle reaction on a post (LIKE, CLAP, LOVE, INSIGHTFUL, CELEBRATE)
 *     tags: [Reactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LIKE, CLAP, LOVE, INSIGHTFUL, CELEBRATE]
 *     responses:
 *       200:
 *         description: Reaction added or removed
 */
router.get("/post/:postId", optionalAuthenticate, getPostReactions);
router.post("/post/:postId", authenticate, writeLimiter, toggleReaction);

export default router;
