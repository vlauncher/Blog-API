import { Router } from "express";
import { seoService } from "./seo.service.js";

const router = Router();

router.get("/feed.xml", async (_req, res) => {
  const xml = await seoService.getRssFeed();
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.header("Cache-Control", "public, max-age=900");
  res.send(xml);
});

router.get("/feed.json", async (_req, res) => {
  const json = await seoService.getJsonFeed();
  res.header("Content-Type", "application/feed+json; charset=utf-8");
  res.header("Cache-Control", "public, max-age=900");
  res.send(json);
});

router.get("/sitemap.xml", async (_req, res) => {
  const xml = await seoService.getSitemapXml();
  res.header("Content-Type", "application/xml; charset=utf-8");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(xml);
});

router.get("/api/seo/structured-data/:slug", async (req, res) => {
  const data = await seoService.getStructuredData(req.params.slug);
  if (!data) {
    res.status(404).json({ status: "fail", message: "Post not found" });
    return;
  }
  res.status(200).json({ status: "success", data });
});

export default router;
