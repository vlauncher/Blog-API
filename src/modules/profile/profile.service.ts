import { prisma } from "../../config/prisma.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../config/cloudinary.js";
import { optimizeImage } from "../../utils/image.js";
import { AppError } from "../../utils/app-error.js";
import type { UpdateProfileInput } from "./profile.schema.js";

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            age: true,
            bio: true,
            phoneNumber: true,
            address: true,
            profilePicture: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        age: input.age,
        bio: input.bio,
        phoneNumber: input.phoneNumber,
        address: input.address,
      },
      update: {
        ...(input.age !== undefined && { age: input.age }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.phoneNumber !== undefined && { phoneNumber: input.phoneNumber }),
        ...(input.address !== undefined && { address: input.address }),
      },
      select: {
        id: true,
        age: true,
        bio: true,
        phoneNumber: true,
        address: true,
        profilePicture: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return profile;
  }

  async updateProfilePicture(userId: string, imageBuffer: Buffer) {
    // 1. Optimize image to max 250KB using Sharp
    const optimizedBuffer = await optimizeImage(imageBuffer);

    // 2. Fetch current profile to check if old picture needs deletion
    const existingProfile = await prisma.profile.findUnique({
      where: { userId },
    });

    // 3. Upload new image to Cloudinary
    const uploadResult = await uploadToCloudinary(optimizedBuffer, "blog/profiles");

    // 4. Delete old image from Cloudinary if it existed
    if (existingProfile?.profilePictureId) {
      await deleteFromCloudinary(existingProfile.profilePictureId);
    }

    // 5. Update Profile in DB
    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        profilePicture: uploadResult.secure_url,
        profilePictureId: uploadResult.public_id,
      },
      update: {
        profilePicture: uploadResult.secure_url,
        profilePictureId: uploadResult.public_id,
      },
      select: {
        id: true,
        age: true,
        bio: true,
        phoneNumber: true,
        address: true,
        profilePicture: true,
        updatedAt: true,
      },
    });

    return updatedProfile;
  }

  async deleteProfilePicture(userId: string) {
    const existingProfile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!existingProfile || !existingProfile.profilePictureId) {
      throw new AppError("No profile picture to delete", 400);
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(existingProfile.profilePictureId);

    // Remove from database
    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: {
        profilePicture: null,
        profilePictureId: null,
      },
      select: {
        id: true,
        age: true,
        bio: true,
        phoneNumber: true,
        address: true,
        profilePicture: true,
        updatedAt: true,
      },
    });

    return updatedProfile;
  }
}

export const profileService = new ProfileService();
