import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateUniqueSlug } from "../../utils/slug.js";
import { CacheService } from "../../services/cache.service.js";
import type { CreateTagInput, UpdateTagInput } from "./tags.schema.js";

export class TagsService {
  async getTags() {
    const cached = await CacheService.get("blog:tags:list");
    if (cached) return cached;

    const tags = await prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: "asc" },
    });

    await CacheService.set("blog:tags:list", tags, 3600);
    return tags;
  }

  async getTagBySlug(slug: string) {
    const tag = await prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: { select: { posts: true } },
      },
    });

    if (!tag) {
      throw new AppError("Tag not found", 404);
    }

    return tag;
  }

  async createTag(input: CreateTagInput) {
    const existing = await prisma.tag.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      return existing; // Idempotent tag creation
    }

    const slug = await generateUniqueSlug(input.name, async (s) => {
      const found = await prisma.tag.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    const tag = await prisma.tag.create({
      data: {
        name: input.name,
        slug,
      },
    });

    await CacheService.invalidateTaxonomy();
    return tag;
  }

  async updateTag(id: string, input: UpdateTagInput) {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new AppError("Tag not found", 404);
    }

    let slug = tag.slug;
    if (input.name && input.name !== tag.name) {
      const existing = await prisma.tag.findUnique({ where: { name: input.name } });
      if (existing && existing.id !== id) {
        throw new AppError("Tag with this name already exists", 409);
      }
      slug = await generateUniqueSlug(input.name, async (s) => {
        const found = await prisma.tag.findUnique({ where: { slug: s } });
        return Boolean(found && found.id !== id);
      });
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        name: input.name,
        slug,
      },
    });

    await CacheService.invalidateTaxonomy();
    return updated;
  }

  async deleteTag(id: string) {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw new AppError("Tag not found", 404);
    }

    await prisma.tag.delete({ where: { id } });
    await CacheService.invalidateTaxonomy();
    return { message: "Tag deleted successfully" };
  }
}

export const tagsService = new TagsService();
