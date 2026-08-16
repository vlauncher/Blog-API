import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";

const app = createApp();

describe("Categories & Tags Integration Tests", () => {
  let adminToken: string;
  let authorToken: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.postTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.post.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();

    const admin = await prisma.user.create({
      data: {
        firstName: "Admin",
        lastName: "User",
        email: "admin@example.com",
        password: "hashedpassword",
        role: "ADMIN",
        isVerified: true,
      },
    });
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: "ADMIN" }, env.JWT_ACCESS_SECRET);

    const author = await prisma.user.create({
      data: {
        firstName: "Author",
        lastName: "User",
        email: "author@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    authorToken = jwt.sign({ userId: author.id, email: author.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);
  });

  it("Categories CRUD and hierarchical tree building", async () => {
    // 1. Create parent category
    const parentRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Engineering",
        description: "Software engineering topics",
      });
    expect(parentRes.status).toBe(201);
    const parentId = parentRes.body.data.id;

    // 2. Create child category
    const childRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Backend",
        parentId,
      });
    expect(childRes.status).toBe(201);

    // 3. Get category tree
    const treeRes = await request(app).get("/api/categories");
    expect(treeRes.status).toBe(200);
    expect(treeRes.body.data[0].name).toBe("Engineering");
    expect(treeRes.body.data[0].children).toHaveLength(1);
    expect(treeRes.body.data[0].children[0].name).toBe("Backend");

    // 4. Update category
    const updateRes = await request(app)
      .put(`/api/categories/${parentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Software Engineering" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Software Engineering");

    // 5. Delete category
    const delRes = await request(app)
      .delete(`/api/categories/${parentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
  });

  it("Tags CRUD and slug fetching", async () => {
    // 1. Create tag
    const createRes = await request(app)
      .post("/api/tags")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ name: "TypeScript" });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.slug).toBe("typescript");
    const tagId = createRes.body.data.id;

    // 2. Get all tags
    const listRes = await request(app).get("/api/tags");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // 3. Get by slug
    const slugRes = await request(app).get("/api/tags/typescript");
    expect(slugRes.status).toBe(200);
    expect(slugRes.body.data.name).toBe("TypeScript");

    // 4. Update tag
    const updateRes = await request(app)
      .put(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ name: "TypeScript 5" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.slug).toBe("typescript-5");

    // 5. Delete tag
    const delRes = await request(app)
      .delete(`/api/tags/${tagId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
  });
});
