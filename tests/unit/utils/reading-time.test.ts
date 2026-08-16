import { describe, it, expect } from "@jest/globals";
import { calculateReadingStats } from "../../../src/utils/reading-time.js";

describe("Reading Time Utility", () => {
  it("should calculate reading time and word count accurately", () => {
    const text = Array(400).fill("word").join(" "); // ~400 words
    const stats = calculateReadingStats(text);

    expect(stats.wordCount).toBe(400);
    expect(stats.readingTimeMinutes).toBe(2);
    expect(stats.readingTimeText).toBe("2 min read");
  });

  it("should return at least 1 minute for short content", () => {
    const text = "Short post";
    const stats = calculateReadingStats(text);

    expect(stats.wordCount).toBe(2);
    expect(stats.readingTimeMinutes).toBe(1);
  });
});
