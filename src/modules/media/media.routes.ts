import { Router } from "express";
import { uploadMedia, deleteMedia } from "./media.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { uploadProfileImage } from "../../middleware/upload.js";
import { writeLimiter } from "../../middleware/rate-limit.js";

const router = Router();

// Media endpoints require authentication and Author/Admin role
router.use(authenticate, requireRole("AUTHOR", "ADMIN"));

/**
 * @openapi
 * /api/media/upload:
 *   post:
 *     summary: Upload and optimize blog image asset (max 250KB via Sharp, stored on Cloudinary)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [picture]
 *             properties:
 *               picture:
 *                 type: string
 *                 format: binary
 *               folder:
 *                 type: string
 *                 example: blog/posts
 *     responses:
 *       201:
 *         description: Media uploaded successfully
 */
router.post("/upload", uploadProfileImage, writeLimiter, uploadMedia);
router.delete("/*publicId", writeLimiter, deleteMedia);

export default router;
