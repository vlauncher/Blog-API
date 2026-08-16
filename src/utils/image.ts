import sharp from "sharp";

export const MAX_PROFILE_IMAGE_SIZE_BYTES = 250 * 1024; // 250 KB

export const optimizeImage = async (
  inputBuffer: Buffer,
  maxBytes: number = MAX_PROFILE_IMAGE_SIZE_BYTES
): Promise<Buffer> => {
  let quality = 85;
  let dimension = 800;

  // Initial optimization to WebP
  let optimizedBuffer = await sharp(inputBuffer)
    .resize(dimension, dimension, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  // Iteratively reduce dimensions and quality if needed
  while (optimizedBuffer.length > maxBytes && (quality > 20 || dimension > 200)) {
    if (quality > 30) {
      quality -= 15;
    } else {
      dimension = Math.round(dimension * 0.8);
    }

    optimizedBuffer = await sharp(inputBuffer)
      .resize(dimension, dimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  return optimizedBuffer;
};
