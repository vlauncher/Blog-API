import { Router } from "express";
import {
  recordView,
  getPostAnalytics,
  getAuthorDashboard,
  getTrendingPosts,
} from "./analytics.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";

const router = Router();

/**
 * @openapi
 * /api/analytics/view/{postId}:
 *   post:
 *     summary: Track a post view with reading completion rate
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               readPercent:
 *                 type: integer
 *                 example: 85
 *               referrer:
 *                 type: string
 *                 example: https://google.com
 *     responses:
 *       200:
 *         description: View recorded
 */
router.post("/view/:postId", recordView);
router.get("/trending", getTrendingPosts);

router.get("/posts/:postId", authenticate, requireRole("AUTHOR", "ADMIN"), getPostAnalytics);
router.get("/dashboard", authenticate, requireRole("AUTHOR", "ADMIN"), getAuthorDashboard);

export default router;
