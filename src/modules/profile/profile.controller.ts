import type { Request, Response } from "express";
import { profileService } from "./profile.service.js";
import { updateProfileSchema } from "./profile.schema.js";
import { AppError } from "../../utils/app-error.js";

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const profile = await profileService.getProfile(userId);
  res.status(200).json({ status: "success", data: profile });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const validated = updateProfileSchema.parse({ body: req.body });
  const profile = await profileService.updateProfile(userId, validated.body);
  res.status(200).json({ status: "success", data: profile });
};

export const updateProfilePicture = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  if (!req.file) {
    throw new AppError("Please provide an image file with key 'picture'", 400);
  }

  const profile = await profileService.updateProfilePicture(userId, req.file.buffer);
  res.status(200).json({ status: "success", data: profile });
};

export const deleteProfilePicture = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const profile = await profileService.deleteProfilePicture(userId);
  res.status(200).json({ status: "success", data: profile });
};
