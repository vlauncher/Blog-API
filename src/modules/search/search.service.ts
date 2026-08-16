import { prisma } from "../../config/prisma.js";
import { buildPaginatedResponse } from "../../utils/pagination.js";

export interface SearchQueryInput {
  q: string;
  cursor?: string;
  limit?: number;
  type?: "all" | "posts" | "authors" | "tags";
}

export class SearchService {
  async search(input: SearchQueryInput) {
    const term = input.q.trim();
    const limit = input.limit || 20;
    const cursor = input.cursor;

    if (!term) {
      return buildPaginatedResponse([], limit);
    }

    // SQLite full text / like query with Prisma
    const posts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        OR: [
          { title: { contains: term } },
          { excerpt: { contains: term } },
          { content: { contains: term } },
          { category: { name: { contains: term } } },
          { tags: { some: { tag: { name: { contains: term } } } } },
          { author: { firstName: { contains: term } } },
          { author: { lastName: { contains: term } } },
        ],
      },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        readingTimeMinutes: true,
        publishedAt: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
        category: { select: { name: true, slug: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    });

    const transformed = posts.map((p) => ({
      ...p,
      tags: p.tags.map((t) => t.tag),
    }));

    return buildPaginatedResponse(transformed, limit);
  }
}

export const searchService = new SearchService();
