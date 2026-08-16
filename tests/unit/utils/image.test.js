import { describe, it, expect } from "@jest/globals";
import sharp from "sharp";
import { optimizeImage, MAX_PROFILE_IMAGE_SIZE_BYTES } from "../../../src/utils/image.js";
describe("Image Optimization Utilities", () => {
    it("should optimize and compress an image to WebP under 250KB", async () => {
        const rawBuffer = await sharp({
            create: {
                width: 1200,
                height: 1200,
                channels: 4,
                background: { r: 255, g: 100, b: 50, alpha: 1 },
            },
        })
            .png()
            .toBuffer();
        const optimized = await optimizeImage(rawBuffer);
        expect(optimized).toBeInstanceOf(Buffer);
        expect(optimized.length).toBeLessThanOrEqual(MAX_PROFILE_IMAGE_SIZE_BYTES);
        const metadata = await sharp(optimized).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBeLessThanOrEqual(800);
        expect(metadata.height).toBeLessThanOrEqual(800);
    });
    it("should handle custom target size parameter and iteratively compress", async () => {
        const rawBuffer = await sharp({
            create: {
                width: 800,
                height: 800,
                channels: 4,
                background: { r: 50, g: 150, b: 250, alpha: 1 },
            },
        })
            .png()
            .toBuffer();
        const smallTargetBytes = 50 * 1024; // 50KB
        const optimized = await optimizeImage(rawBuffer, smallTargetBytes);
        expect(optimized.length).toBeLessThanOrEqual(smallTargetBytes);
    });
});
//# sourceMappingURL=image.test.js.map