import { Router } from "express";
import {
  getCategoryTree,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Retrieve category hierarchy tree
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Hierarchy of categories
 *   post:
 *     summary: Create category (Admin/Author only)
 *     tags: [Categories]
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
 *               description:
 *                 type: string
 *               parentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 */
router.get("/", getCategoryTree);
router.get("/:slug", getCategoryBySlug);
router.post("/", authenticate, requireRole("AUTHOR", "ADMIN"), writeLimiter, createCategory);
router.put("/:id", authenticate, requireRole("ADMIN"), writeLimiter, updateCategory);
router.delete("/:id", authenticate, requireRole("ADMIN"), deleteCategory);

export default router;
