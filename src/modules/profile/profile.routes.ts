import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateProfilePicture,
  deleteProfilePicture,
} from "./profile.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { uploadProfileImage } from "../../middleware/upload.js";

const router = Router();

// All profile endpoints require authentication
router.use(authenticate);

/**
 * @openapi
 * /api/profile:
 *   get:
 *     summary: Retrieve user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *       401:
 *         description: Unauthorized
 *   patch:
 *     summary: Update profile details (age, bio, phoneNumber, address)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               age:
 *                 type: integer
 *                 example: 28
 *               bio:
 *                 type: string
 *                 example: Full stack software engineer & tech blogger.
 *               phoneNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               address:
 *                 type: string
 *                 example: "123 Tech Blvd, Silicon Valley"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.get("/", getProfile);
router.patch("/", updateProfile);

/**
 * @openapi
 * /api/profile/picture:
 *   patch:
 *     summary: Upload or update profile picture (optimized to max 250KB via Sharp)
 *     tags: [Profile]
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
 *     responses:
 *       200:
 *         description: Profile picture uploaded and updated successfully
 *       400:
 *         description: Invalid image file or missing picture key
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete profile picture from Cloudinary and database
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile picture removed
 *       400:
 *         description: No profile picture to delete
 *       401:
 *         description: Unauthorized
 */
router.patch("/picture", uploadProfileImage, updateProfilePicture);
router.delete("/picture", deleteProfilePicture);

export default router;
