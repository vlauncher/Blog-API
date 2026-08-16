import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/app-error.js";
import { buildPaginatedResponse } from "../../utils/pagination.js";
import { NotificationService } from "../../services/notification.service.js";

export class FollowsService {
  async toggleFollow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new AppError("You cannot follow yourself", 400);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
      include: { profile: true },
    });

    if (!targetUser) {
      throw new AppError("User not found", 404);
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      return { isFollowing: false };
    }

    await prisma.follow.create({
      data: { followerId, followingId },
    });

    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { firstName: true, lastName: true },
    });

    const followerName = follower ? `${follower.firstName} ${follower.lastName}` : "Someone";
    await NotificationService.send({
      userId: followingId,
      actorId: followerId,
      type: "NEW_FOLLOWER",
      message: `${followerName} started following you`,
    });

    return { isFollowing: true };
  }

  async getFollowers(userId: string, cursor?: string, limit = 20) {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        follower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { bio: true, profilePicture: true } },
          },
        },
      },
    });

    const transformed = followers.map((f) => ({
      id: f.id,
      createdAt: f.createdAt,
      user: f.follower,
    }));

    return buildPaginatedResponse(transformed, limit);
  }

  async getFollowing(userId: string, cursor?: string, limit = 20) {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        following: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profile: { select: { bio: true, profilePicture: true } },
          },
        },
      },
    });

    const transformed = following.map((f) => ({
      id: f.id,
      createdAt: f.createdAt,
      user: f.following,
    }));

    return buildPaginatedResponse(transformed, limit);
  }
}

export const followsService = new FollowsService();
