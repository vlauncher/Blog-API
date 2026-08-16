import { prisma } from "../../config/prisma.js";
import { buildPaginatedResponse } from "../../utils/pagination.js";
import { AppError } from "../../utils/app-error.js";

export class NotificationsModuleService {
  async getUserNotifications(userId: string, cursor?: string, limit = 20) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { profilePicture: true } },
          },
        },
      },
    });

    const transformed = notifications.map((n) => ({
      ...n,
      data: n.data ? JSON.parse(n.data) : null,
    }));

    return buildPaginatedResponse(transformed, limit);
  }

  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new AppError("Notification not found", 404);
    }

    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { message: "All notifications marked as read" };
  }

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { unreadCount: count };
  }
}

export const notificationsModuleService = new NotificationsModuleService();
