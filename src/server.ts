import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";
import { initScheduledPublishJob, stopScheduledPublishJob } from "./jobs/scheduled-publish.js";
import type { Server } from "node:http";

const app = createApp();

// Start scheduled post publisher
initScheduledPublishJob();

const server: Server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  logger.info(`👉 Swagger Docs: http://localhost:${env.PORT}/docs`);
  logger.info(`👉 ReDoc Docs:   http://localhost:${env.PORT}/`);
  logger.info(`👉 Health check: http://localhost:${env.PORT}/api/health`);
  logger.info(`👉 RSS Feed:     http://localhost:${env.PORT}/feed.xml`);
  logger.info(`👉 Sitemap:      http://localhost:${env.PORT}/sitemap.xml`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop background cron jobs
  stopScheduledPublishJob();

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Error occurred during HTTP server close");
    }

    try {
      await prisma.$disconnect();
      logger.info("Prisma disconnected successfully.");
    } catch (prismaErr) {
      logger.error({ prismaErr }, "Error disconnecting Prisma");
    }

    try {
      await redis.quit();
      logger.info("Redis disconnected successfully.");
    } catch (redisErr) {
      logger.error({ redisErr }, "Error disconnecting Redis");
    }

    logger.info("Server gracefully terminated.");
    process.exit(err ? 1 : 0);
  });

  // Force close if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled Rejection encountered");
  throw reason;
});

process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught Exception encountered");
  process.exit(1);
});
