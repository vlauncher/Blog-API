import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { generateUniqueSlug } from "../../utils/slug.js";
import { CacheService } from "../../services/cache.service.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema.js";

export class CategoriesService {
  async getCategoryTree() {
    const cached = await CacheService.get("blog:categories:tree");
    if (cached) return cached;

    // Fetch all categories
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: "asc" },
    });

    // Build hierarchical tree
    const categoryMap = new Map<string, any>();
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const rootCategories: any[] = [];
    categories.forEach((cat) => {
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(categoryMap.get(cat.id));
      } else {
        rootCategories.push(categoryMap.get(cat.id));
      }
    });

    await CacheService.set("blog:categories:tree", rootCategories, 3600);
    return rootCategories;
  }

  async getCategoryBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        children: true,
        parent: true,
        _count: { select: { posts: true } },
      },
    });

    if (!category) {
      throw new AppError("Category not found", 404);
    }

    return category;
  }

  async createCategory(input: CreateCategoryInput) {
    const existing = await prisma.category.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      throw new AppError("Category with this name already exists", 409);
    }

    if (input.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new AppError("Parent category not found", 404);
      }
    }

    const slug = await generateUniqueSlug(input.name, async (s) => {
      const found = await prisma.category.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        parentId: input.parentId,
      },
    });

    await CacheService.invalidateTaxonomy();
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    if (input.parentId && input.parentId === id) {
      throw new AppError("Category cannot be its own parent", 400);
    }

    let slug = category.slug;
    if (input.name && input.name !== category.name) {
      const existing = await prisma.category.findUnique({ where: { name: input.name } });
      if (existing && existing.id !== id) {
        throw new AppError("Category with this name already exists", 409);
      }
      slug = await generateUniqueSlug(input.name, async (s) => {
        const found = await prisma.category.findUnique({ where: { slug: s } });
        return Boolean(found && found.id !== id);
      });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name, slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
      },
    });

    await CacheService.invalidateTaxonomy();
    return updated;
  }

  async deleteCategory(id: string) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError("Category not found", 404);
    }

    await prisma.category.delete({ where: { id } });
    await CacheService.invalidateTaxonomy();
    return { message: "Category deleted successfully" };
  }
}

export const categoriesService = new CategoriesService();
