import multer from "multer";
import { AppError } from "../utils/app-error.js";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Invalid file format. Only JPEG, PNG, WEBP, and GIF images are allowed.",
        400
      )
    );
  }
};

export const uploadProfileImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max upload before Sharp optimization
  },
  fileFilter,
}).single("picture");
