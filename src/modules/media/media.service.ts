import { uploadToCloudinary, deleteFromCloudinary } from "../../config/cloudinary.js";
import { optimizeImage } from "../../utils/image.js";
import { AppError } from "../../utils/app-error.js";

export class MediaService {
  async uploadMedia(buffer: Buffer, folder = "blog/posts") {
    if (!buffer || buffer.length === 0) {
      throw new AppError("No image file provided", 400);
    }

    // Optimize image to max 250KB
    const optimized = await optimizeImage(buffer, 250);
    const result = await uploadToCloudinary(optimized, folder);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  }

  async deleteMedia(publicId: string) {
    if (!publicId) {
      throw new AppError("Public ID is required", 400);
    }

    await deleteFromCloudinary(publicId);
    return { message: "Media deleted successfully" };
  }
}

export const mediaService = new MediaService();
