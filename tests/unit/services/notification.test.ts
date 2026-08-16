import { describe, it, expect, beforeEach } from "@jest/globals";
import { NotificationService } from "../../../src/services/notification.service.js";
import { prisma } from "../../../src/config/prisma.js";

describe("NotificationService Unit Tests", () => {
  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.user.deleteMany();
  });

  it("should create in-app notification record and omit self-notification", async () => {
    const user1 = await prisma.user.create({
      data: {
        firstName: "User1",
        lastName: "Test",
        email: "u1@example.com",
        password: "hash",
        isVerified: true,
      },
    });

    // 1. Self notification should be ignored
    await NotificationService.send({
      userId: user1.id,
      actorId: user1.id,
      type: "COMMENT",
      message: "Self comment",
    });

    const count1 = await prisma.notification.count();
    expect(count1).toBe(0);

    // 2. Notification from another actor
    const user2 = await prisma.user.create({
      data: {
        firstName: "User2",
        lastName: "Test",
        email: "u2@example.com",
        password: "hash",
        isVerified: true,
      },
    });

    await NotificationService.send({
      userId: user1.id,
      actorId: user2.id,
      type: "COMMENT",
      message: "User2 commented",
    });

    const count2 = await prisma.notification.count();
    expect(count2).toBe(1);
  });
});
