import { Router } from "express";
import {
  subscribe,
  confirmSubscription,
  unsubscribe,
  getSubscribers,
} from "./newsletter.controller.js";
import { authenticate, optionalAuthenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

/**
 * @openapi
 * /api/newsletter/subscribe:
 *   post:
 *     summary: Subscribe to newsletter (Double opt-in verification email dispatched)
 *     tags: [Newsletter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Subscription email sent
 */
router.post("/subscribe", optionalAuthenticate, writeLimiter, subscribe);
router.get("/confirm/:token", confirmSubscription);
router.get("/unsubscribe/:token", unsubscribe);

router.get("/subscribers", authenticate, requireRole("ADMIN"), getSubscribers);

export default router;
