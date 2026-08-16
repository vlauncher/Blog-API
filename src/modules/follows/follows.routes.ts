import { Router } from "express";
import { toggleFollow, getFollowers, getFollowing } from "./follows.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/follows/user/{userId}:
 *   post:
 *     summary: Follow or unfollow a user/author
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Follow status toggled
 */
router.post("/user/:userId", authenticate, writeLimiter, toggleFollow);
router.get("/user/:userId/followers", getFollowers);
router.get("/user/:userId/following", getFollowing);

export default router;
