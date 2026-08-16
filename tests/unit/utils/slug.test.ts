import { describe, it, expect } from "@jest/globals";
import { generateSlug, generateUniqueSlug } from "../../../src/utils/slug.js";

describe("Slug Utilities", () => {
  it("should generate lowercase URL-friendly slug", () => {
    const slug = generateSlug("How to Build APIs in 2026! (Full Guide)");
    expect(slug).toBe("how-to-build-apis-in-2026-full-guide");
  });

  it("should generate unique slug by appending incremental counter if collision occurs", async () => {
    const existing = new Set(["my-awesome-post", "my-awesome-post-1"]);

    const checkExists = async (s: string) => existing.has(s);

    const slug = await generateUniqueSlug("My Awesome Post", checkExists);
    expect(slug).toBe("my-awesome-post-2");
  });

  it("should handle empty or whitespace titles with fallback", async () => {
    const checkExists = async () => false;
    const slug = await generateUniqueSlug("   ", checkExists);
    expect(slug).toBe("post");
  });
});
