import { Router } from "express";
import { search } from "./search.controller.js";

const router = Router();

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Full text search across posts, authors, tags, and categories
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results
 */
router.get("/", search);

export default router;
