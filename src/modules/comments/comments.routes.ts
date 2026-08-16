import { Router } from "express";
import {
  getPostComments,
  createComment,
  updateComment,
  deleteComment,
} from "./comments.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/comments/post/{postId}:
 *   get:
 *     summary: Get threaded comments for a post
 *     tags: [Comments]
 *     responses:
 *       200:
 *         description: Threaded comments array
 *   post:
 *     summary: Post a comment or reply
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment created
 */
router.get("/post/:postId", getPostComments);
router.post("/post/:postId", authenticate, writeLimiter, createComment);

router.put("/:id", authenticate, writeLimiter, updateComment);
router.delete("/:id", authenticate, deleteComment);

export default router;
