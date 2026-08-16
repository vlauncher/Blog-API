import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { redis } from "../../src/config/redis.js";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env.js";
import { notificationEmitter } from "../../src/services/notification.service.js";

const app = createApp();

describe("Notifications, Newsletter & Webhooks Integration Tests", () => {
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let adminId: string;

  beforeEach(async () => {
    await redis.flushall();
    await prisma.notification.deleteMany();
    await prisma.subscriber.deleteMany();
    await prisma.webhook.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        firstName: "Normal",
        lastName: "User",
        email: "normal@example.com",
        password: "hashedpassword",
        role: "AUTHOR",
        isVerified: true,
      },
    });
    userId = user.id;
    userToken = jwt.sign({ userId: user.id, email: user.email, role: "AUTHOR" }, env.JWT_ACCESS_SECRET);

    const admin = await prisma.user.create({
      data: {
        firstName: "Super",
        lastName: "Admin",
        email: "admin@example.com",
        password: "hashedpassword",
        role: "ADMIN",
        isVerified: true,
      },
    });
    adminId = admin.id;
    adminToken = jwt.sign({ userId: admin.id, email: admin.email, role: "ADMIN" }, env.JWT_ACCESS_SECRET);
  });

  it("Notifications - list, unread count, mark as read, and SSE stream connection", async () => {
    // 1. Test SSE Stream connection
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const response = await fetch(`http://localhost:${port}/api/notifications/stream`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    // Emit event on channel
    notificationEmitter.emit(`user:${userId}`, { message: "Test event" });

    // Close reader and server
    const reader = response.body?.getReader();
    await reader?.cancel();
    server.close();

    // 2. Seed a notification
    const notif = await prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        message: "Welcome to the platform!",
        isRead: false,
      },
    });

    // 3. Get notifications
    const listRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // 4. Get unread count
    const countRes = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${userToken}`);

    expect(countRes.status).toBe(200);
    expect(countRes.body.data.unreadCount).toBe(1);

    // 5. Mark single notification as read
    const readRes = await request(app)
      .put(`/api/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.isRead).toBe(true);

    // 6. Mark all as read
    const allReadRes = await request(app)
      .put("/api/notifications/read-all")
      .set("Authorization", `Bearer ${userToken}`);

    expect(allReadRes.status).toBe(200);
  });

  it("Newsletter - double opt-in subscribe, confirm, and unsubscribe", async () => {
    // 1. Subscribe
    const subRes = await request(app)
      .post("/api/newsletter/subscribe")
      .send({ email: "subscriber@example.com" });

    expect(subRes.status).toBe(200);

    const subscriber = await prisma.subscriber.findUnique({
      where: { email: "subscriber@example.com" },
    });
    expect(subscriber).toBeDefined();
    expect(subscriber?.isConfirmed).toBe(false);
    const confirmToken = subscriber!.confirmToken!;
    const unsubToken = subscriber!.unsubToken;

    // 2. Confirm subscription
    const confRes = await request(app).get(`/api/newsletter/confirm/${confirmToken}`);
    expect(confRes.status).toBe(200);

    // 3. Admin lists subscribers
    const listSubRes = await request(app)
      .get("/api/newsletter/subscribers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listSubRes.status).toBe(200);
    expect(listSubRes.body.data).toHaveLength(1);

    // 4. Unsubscribe
    const unsubRes = await request(app).get(`/api/newsletter/unsubscribe/${unsubToken}`);
    expect(unsubRes.status).toBe(200);

    const check = await prisma.subscriber.findUnique({
      where: { email: "subscriber@example.com" },
    });
    expect(check).toBeNull();
  });

  it("Webhooks - register, list, and delete webhooks", async () => {
    // 1. Register webhook
    const regRes = await request(app)
      .post("/api/webhooks")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        url: "https://my-service.com/webhook",
        secret: "super-secret-key-123",
        events: ["post.published", "comment.created"],
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.url).toBe("https://my-service.com/webhook");
    const webhookId = regRes.body.data.id;

    // 2. List webhooks
    const listRes = await request(app)
      .get("/api/webhooks")
      .set("Authorization", `Bearer ${userToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    // 3. Delete webhook
    const delRes = await request(app)
      .delete(`/api/webhooks/${webhookId}`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(delRes.status).toBe(200);
  });
});
