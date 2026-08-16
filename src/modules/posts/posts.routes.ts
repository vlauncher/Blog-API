import { Router } from "express";
import {
  createPost,
  getPosts,
  getPostBySlug,
  getPostById,
  updatePost,
  publishPost,
  schedulePost,
  archivePost,
  deletePost,
  restorePost,
  getRevisions,
  restoreRevision,
} from "./posts.controller.js";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/posts:
 *   get:
 *     summary: List published posts with cursor pagination and filtering
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: categorySlug
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest, popular]
 *     responses:
 *       200:
 *         description: Paginated posts list
 *   post:
 *     summary: Create a new blog post draft (Authors/Admins)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *                 description: Markdown format content
 *               excerpt:
 *                 type: string
 *               coverImage:
 *                 type: string
 *               categoryId:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Post draft created
 */
router.get("/", getPosts);
router.post("/", authenticate, requireRole("AUTHOR", "ADMIN"), writeLimiter, createPost);

router.get("/slug/:slug", optionalAuthenticate, getPostBySlug);
router.get("/:id", getPostById);
router.put("/:id", authenticate, requireRole("AUTHOR", "ADMIN"), writeLimiter, updatePost);
router.delete("/:id", authenticate, requireRole("AUTHOR", "ADMIN"), deletePost);

// Lifecycle routes
router.post("/:id/publish", authenticate, requireRole("AUTHOR", "ADMIN"), publishPost);
router.post("/:id/schedule", authenticate, requireRole("AUTHOR", "ADMIN"), schedulePost);
router.post("/:id/archive", authenticate, requireRole("AUTHOR", "ADMIN"), archivePost);
router.post("/:id/restore", authenticate, requireRole("AUTHOR", "ADMIN"), restorePost);

// Version history / revisions
router.get("/:id/revisions", authenticate, requireRole("AUTHOR", "ADMIN"), getRevisions);
router.post("/:id/revisions/:revisionId/restore", authenticate, requireRole("AUTHOR", "ADMIN"), restoreRevision);

export default router;
