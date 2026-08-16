import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env.js";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Blog API",
      version: "1.0.0",
      description:
        "Production-grade Express 5 + TypeScript Blog REST API with JWT Auth, OTP verification, and Profile management.",
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Local Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT Bearer token",
        },
      },
    },
  },
  apis: ["./src/modules/**/*.routes.ts", "./dist/modules/**/*.routes.js"],
};

export const swaggerSpec = swaggerJSDoc(options) as Record<string, unknown>;
