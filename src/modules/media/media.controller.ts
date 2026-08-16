import type { Request, Response } from "express";
import { mediaService } from "./media.service.js";
import { AppError } from "../../utils/app-error.js";

export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    throw new AppError("Please upload an image file", 400);
  }

  const folder = (req.body.folder as string) || "blog/posts";
  const result = await mediaService.uploadMedia(req.file.buffer, folder);

  res.status(201).json({
    status: "success",
    data: result,
  });
};

export const deleteMedia = async (req: Request, res: Response): Promise<void> => {
  const publicId = String(req.params.publicId || req.body.publicId || "");
  const result = await mediaService.deleteMedia(publicId);

  res.status(200).json({
    status: "success",
    ...result,
  });
};
