import compression from "compression";
import type { Request, Response } from "express";

export const compressionMiddleware = compression({
  threshold: 1024, // Only compress responses > 1KB
  filter: (req: Request, res: Response) => {
    // Skip compression for Server-Sent Events (SSE)
    if (req.headers.accept === "text/event-stream") {
      return false;
    }
    if (req.headers["x-no-compression"]) {
      return false;
    }
    return compression.filter(req, res);
  },
});
