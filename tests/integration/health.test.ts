import { describe, it, expect, jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";

const app = createApp();

describe("Health Check API", () => {
  it("GET /api/health should return 200 and healthy status when all services connect", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("environment");
    expect(res.body.services).toEqual({
      database: "connected",
      redis: "connected",
    });
  });

  it("GET /api/health should return 503 degraded if database query fails", async () => {
    const queryRawSpy = jest.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("DB Connection Lost"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.services.database).toBe("disconnected");

    queryRawSpy.mockRestore();
  });

  it("GET /api/health should return 503 degraded if redis ping returns non-PONG or fails", async () => {
    const redisPingSpy = jest.spyOn(redis, "ping").mockResolvedValueOnce("FAIL" as any);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.services.redis).toBe("error");

    redisPingSpy.mockRestore();
  });

  it("GET /api/health should return 503 degraded if redis ping throws error", async () => {
    const redisPingSpy = jest.spyOn(redis, "ping").mockRejectedValueOnce(new Error("Redis offline"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.services.redis).toBe("disconnected");

    redisPingSpy.mockRestore();
  });
});
