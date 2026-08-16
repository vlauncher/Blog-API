import type { Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  let dbStatus = "connected";
  let redisStatus = "connected";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "disconnected";
  }

  try {
    const ping = await redis.ping();
    if (ping !== "PONG") {
      redisStatus = "error";
    }
  } catch {
    redisStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected" && redisStatus === "connected";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(2)}s`,
    environment: env.NODE_ENV,
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  });
};
