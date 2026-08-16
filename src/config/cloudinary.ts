import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { Readable } from "node:stream";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export const uploadToCloudinary = (
  buffer: Buffer,
  folder = "blog/profiles"
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          logger.error({ error }, "Cloudinary upload error");
          return reject(error ?? new Error("Cloudinary upload failed"));
        }
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId }, "Deleted image from Cloudinary");
  } catch (error) {
    logger.warn({ error, publicId }, "Failed to delete old image from Cloudinary");
  }
};
