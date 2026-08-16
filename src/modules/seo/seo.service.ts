import { Feed } from "feed";
import { SitemapStream, streamToPromise } from "sitemap";
import { Readable } from "node:stream";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { CacheService } from "../../services/cache.service.js";

const SITE_URL = env.SITE_URL;

export class SeoService {
  async getRssFeed(): Promise<string> {
    const cached = await CacheService.get<string>("blog:feed:rss");
    if (cached) return cached;

    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: {
        author: { select: { firstName: true, lastName: true, email: true } },
        category: { select: { name: true } },
      },
    });

    const feed = new Feed({
      title: "Modern Blog API",
      description: "Latest high quality articles and tutorials",
      id: SITE_URL,
      link: SITE_URL,
      language: "en",
      image: `${SITE_URL}/favicon.ico`,
      favicon: `${SITE_URL}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: posts[0]?.publishedAt || new Date(),
      generator: "Blog API 2026",
      feedLinks: {
        rss2: `${SITE_URL}/feed.xml`,
        json: `${SITE_URL}/feed.json`,
      },
    });

    posts.forEach((post) => {
      feed.addItem({
        title: post.title,
        id: `${SITE_URL}/posts/${post.slug}`,
        link: `${SITE_URL}/posts/${post.slug}`,
        description: post.excerpt || "",
        content: post.contentHtml || post.content,
        author: [
          {
            name: `${post.author.firstName} ${post.author.lastName}`,
            email: post.author.email,
          },
        ],
        date: post.publishedAt || post.createdAt,
        image: post.coverImage || undefined,
        category: post.category ? [{ name: post.category.name }] : undefined,
      });
    });

    const rssXml = feed.rss2();
    await CacheService.set("blog:feed:rss", rssXml, 900); // 15 min cache
    return rssXml;
  }

  async getJsonFeed(): Promise<string> {
    const cached = await CacheService.get<string>("blog:feed:json");
    if (cached) return cached;

    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
    });

    const feed = new Feed({
      title: "Modern Blog API",
      description: "Latest high quality articles and tutorials",
      id: SITE_URL,
      link: SITE_URL,
      language: "en",
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: posts[0]?.publishedAt || new Date(),
    });

    posts.forEach((post) => {
      feed.addItem({
        title: post.title,
        id: `${SITE_URL}/posts/${post.slug}`,
        link: `${SITE_URL}/posts/${post.slug}`,
        description: post.excerpt || "",
        content: post.contentHtml || post.content,
        author: [{ name: `${post.author.firstName} ${post.author.lastName}` }],
        date: post.publishedAt || post.createdAt,
      });
    });

    const jsonFeed = feed.json1();
    await CacheService.set("blog:feed:json", jsonFeed, 900);
    return jsonFeed;
  }

  async getSitemapXml(): Promise<string> {
    const cached = await CacheService.get<string>("blog:sitemap");
    if (cached) return cached;

    const stream = new SitemapStream({ hostname: SITE_URL });

    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true, updatedAt: true },
    });

    const categories = await prisma.category.findMany({
      select: { slug: true, updatedAt: true },
    });

    const tags = await prisma.tag.findMany({
      select: { slug: true, createdAt: true },
    });

    const sitemapEntries = [
      { url: "/", changefreq: "daily", priority: 1.0 },
      ...posts.map((p) => ({
        url: `/posts/${p.slug}`,
        changefreq: "weekly",
        priority: 0.8,
        lastmod: p.updatedAt,
      })),
      ...categories.map((c) => ({
        url: `/categories/${c.slug}`,
        changefreq: "weekly",
        priority: 0.6,
        lastmod: c.updatedAt,
      })),
      ...tags.map((t) => ({
        url: `/tags/${t.slug}`,
        changefreq: "monthly",
        priority: 0.4,
        lastmod: t.createdAt,
      })),
    ];

    const xmlBuffer = await streamToPromise(Readable.from(sitemapEntries).pipe(stream));
    const xml = xmlBuffer.toString();

    await CacheService.set("blog:sitemap", xml, 86400); // 24 hours
    return xml;
  }

  async getStructuredData(slug: string) {
    const post = await prisma.post.findUnique({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
      },
    });

    if (!post) return null;

    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      image: post.ogImage || post.coverImage,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `${SITE_URL}/posts/${post.slug}`,
      },
      author: {
        "@type": "Person",
        name: `${post.author.firstName} ${post.author.lastName}`,
        image: post.author.profile?.profilePicture,
      },
      publisher: {
        "@type": "Organization",
        name: "Blog API",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/logo.png`,
        },
      },
    };
  }
}

export const seoService = new SeoService();
