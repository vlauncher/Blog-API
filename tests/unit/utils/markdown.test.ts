import { describe, it, expect } from "@jest/globals";
import {
  renderMarkdownToHtml,
  extractTableOfContents,
  extractExcerpt,
  sanitizeContent,
} from "../../../src/utils/markdown.js";

describe("Markdown Utilities", () => {
  it("should render markdown to sanitized HTML", async () => {
    const md = "# Hello World\n\nThis is **bold** text and [a link](https://example.com).";
    const html = await renderMarkdownToHtml(md);

    expect(html).toContain("Hello World");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('<a href="https://example.com"');
  });

  it("should strip malicious script tags via sanitizeContent / XSS protection", async () => {
    const malicious = '<script>alert("hacked")</script><p>Safe text</p><img src="x" onerror="alert(1)">';
    const clean = sanitizeContent(malicious);

    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("alert");
    expect(clean).toContain("<p>Safe text</p>");
  });

  it("should extract table of contents with levels, text, and slug", () => {
    const md = `
# Main Header
Some intro text

## Getting Started
Installation instructions

### Prerequisites
Node and NPM

## Advanced Usage
Deep dive
    `;

    const toc = extractTableOfContents(md);

    expect(toc).toHaveLength(4);
    expect(toc[0]).toEqual({
      level: 1,
      text: "Main Header",
      slug: "main-header",
    });
    expect(toc[1]).toEqual({
      level: 2,
      text: "Getting Started",
      slug: "getting-started",
    });
    expect(toc[2]).toEqual({
      level: 3,
      text: "Prerequisites",
      slug: "prerequisites",
    });
  });

  it("should extract excerpt and truncate to maxLength", () => {
    const shortText = "This is a brief summary of the article.";
    expect(extractExcerpt(shortText, 160)).toBe(shortText);

    const longText =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
    const excerpt = extractExcerpt(longText, 50);

    expect(excerpt.length).toBeLessThanOrEqual(53); // 50 chars + "..."
    expect(excerpt.endsWith("...")).toBe(true);
  });
});
