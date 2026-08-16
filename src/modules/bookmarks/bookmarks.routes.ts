import { Router } from "express";
import { toggleBookmark, getUserBookmarks } from "./bookmarks.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

// All bookmark routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /api/bookmarks:
 *   get:
 *     summary: Retrieve user's saved/bookmarked posts
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: List of saved bookmarks
 */
router.get("/", getUserBookmarks);
router.post("/post/:postId", writeLimiter, toggleBookmark);

export default router;
