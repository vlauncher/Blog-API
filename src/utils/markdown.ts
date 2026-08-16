import { marked } from "marked";
import xss from "xss";

export interface TocItem {
  level: number;
  text: string;
  slug: string;
}

const defaultWhiteList =
  typeof (xss as any).getDefaultWhiteList === "function"
    ? (xss as any).getDefaultWhiteList()
    : {};

const XSS_OPTIONS: any = {
  whiteList: {
    ...defaultWhiteList,
    h1: ["id"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    h5: ["id"],
    h6: ["id"],
    code: ["class"],
    pre: ["class"],
    span: ["class"],
    img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
    a: ["href", "title", "target", "rel", "id"],
    th: ["align"],
    td: ["align"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
};

export const sanitizeContent = (dirtyHtml: string): string => {
  return xss(dirtyHtml, XSS_OPTIONS);
};

export const renderMarkdownToHtml = async (markdown: string): Promise<string> => {
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const rawHtml = await marked.parse(markdown);
  return sanitizeContent(rawHtml);
};

export const extractTableOfContents = (markdown: string): TocItem[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    toc.push({ level, text, slug });
  }

  return toc;
};

export const extractExcerpt = (markdown: string, maxLength = 160): string => {
  // Strip markdown formatting for plain text excerpt
  const plainText = markdown
    .replace(/!\[.*?\]\(.*?\)/g, "") // remove images
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // link text only
    .replace(/#{1,6}\s+/g, "") // headers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/`{1,3}.*?`{1,3}/gs, "") // inline code and blocks
    .replace(/>\s+/g, "") // blockquotes
    .replace(/[-*+]\s+/g, "") // list bullets
    .replace(/\n+/g, " ") // line breaks to space
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.slice(0, maxLength).trim() + "...";
};
