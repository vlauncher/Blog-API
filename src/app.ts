import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { pinoHttp } from "pino-http";
import { logger } from "./utils/logger.js";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { compressionMiddleware } from "./middleware/compression.js";
import { globalLimiter } from "./middleware/rate-limit.js";

// Module routes
import healthRouter from "./modules/health/health.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import profileRouter from "./modules/profile/profile.routes.js";
import postsRouter from "./modules/posts/posts.routes.js";
import categoriesRouter from "./modules/categories/categories.routes.js";
import tagsRouter from "./modules/tags/tags.routes.js";
import mediaRouter from "./modules/media/media.routes.js";
import commentsRouter from "./modules/comments/comments.routes.js";
import reactionsRouter from "./modules/reactions/reactions.routes.js";
import bookmarksRouter from "./modules/bookmarks/bookmarks.routes.js";
import followsRouter from "./modules/follows/follows.routes.js";
import searchRouter from "./modules/search/search.routes.js";
import analyticsRouter from "./modules/analytics/analytics.routes.js";
import notificationsRouter from "./modules/notifications/notifications.routes.js";
import newsletterRouter from "./modules/newsletter/newsletter.routes.js";
import webhooksRouter from "./modules/webhooks/webhooks.routes.js";
import seoRouter from "./modules/seo/seo.routes.js";

import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

export const createApp = (): Application => {
  const app = express();

  // Security and core middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI and ReDoc to render CDN assets properly
    })
  );
  app.use(cors());
  app.use(compressionMiddleware);
  app.use(globalLimiter);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP Request Logging
  if (env.NODE_ENV !== "test") {
    app.use(
      pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) =>
            req.url === "/api/health" ||
            req.url?.startsWith("/docs") ||
            req.url === "/" ||
            req.url?.startsWith("/feed") ||
            req.url === "/sitemap.xml",
        },
      })
    );
  }

  // Swagger JSON endpoint
  app.get("/docs/swagger.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Swagger UI route
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Blog API - Swagger Documentation",
    })
  );

  // ReDoc UI at root /
  app.get("/", (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Blog API - ReDoc Documentation</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url="/docs/swagger.json"></redoc>
          <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `);
  });

  // SEO Feeds & Sitemaps (Root-level)
  app.use(seoRouter);

  // API Module routes
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/comments", commentsRouter);
  app.use("/api/reactions", reactionsRouter);
  app.use("/api/bookmarks", bookmarksRouter);
  app.use("/api/follows", followsRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/newsletter", newsletterRouter);
  app.use("/api/webhooks", webhooksRouter);

  // 404 catch-all
  app.use(notFoundHandler);

  // Centralized Error handler
  app.use(errorHandler);

  return app;
};
