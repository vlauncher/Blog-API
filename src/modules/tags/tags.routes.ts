import { Router } from "express";
import {
  getTags,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag,
} from "./tags.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/tags:
 *   get:
 *     summary: Retrieve list of tags
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: List of tags with post counts
 *   post:
 *     summary: Create new tag (Authenticated)
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tag created
 */
router.get("/", getTags);
router.get("/:slug", getTagBySlug);
router.post("/", authenticate, writeLimiter, createTag);
router.put("/:id", authenticate, requireRole("AUTHOR", "ADMIN"), writeLimiter, updateTag);
router.delete("/:id", authenticate, requireRole("ADMIN"), deleteTag);

export default router;
