import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("Documentation Endpoints", () => {
  it("GET /docs/swagger.json should return OpenAPI specification", async () => {
    const res = await request(app).get("/docs/swagger.json");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("openapi", "3.0.3");
    expect(res.body.info).toHaveProperty("title", "Blog API");
  });

  it("GET / should serve ReDoc HTML page", async () => {
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Blog API - ReDoc Documentation");
    expect(res.text).toContain("<redoc spec-url=\"/docs/swagger.json\"></redoc>");
  });

  it("GET /docs/ should serve Swagger UI HTML", async () => {
    const res = await request(app).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
