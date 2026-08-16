import crypto from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { sendMail } from "../../config/mailer.js";
import { AppError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";

const SITE_URL = env.SITE_URL;

export class NewsletterService {
  async subscribe(email: string, userId?: string) {
    const existing = await prisma.subscriber.findUnique({ where: { email } });

    if (existing && existing.isConfirmed) {
      return { message: "You are already subscribed to the newsletter!" };
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");

    await prisma.subscriber.upsert({
      where: { email },
      create: {
        email,
        userId,
        confirmToken,
        isConfirmed: false,
      },
      update: {
        confirmToken,
        isConfirmed: false,
      },
    });

    const confirmLink = `${SITE_URL}/api/newsletter/confirm/${confirmToken}`;

    await sendMail({
      to: email,
      subject: "Confirm your Blog Newsletter Subscription",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
          <h2>Confirm your Subscription</h2>
          <p>Thank you for subscribing to our blog newsletter. Please click the button below to confirm your email address:</p>
          <div style="margin: 25px 0;">
            <a href="${confirmLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Confirm Subscription
            </a>
          </div>
          <p>Or paste this link into your browser: <br/><a href="${confirmLink}">${confirmLink}</a></p>
        </div>
      `,
    });

    return {
      message: "Subscription initiated! Please check your email to confirm your subscription.",
    };
  }

  async confirmSubscription(token: string) {
    const subscriber = await prisma.subscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      throw new AppError("Invalid or expired confirmation link", 400);
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        isConfirmed: true,
        confirmToken: null,
        confirmedAt: new Date(),
      },
    });

    return { message: "Subscription successfully confirmed! Welcome aboard." };
  }

  async unsubscribe(token: string) {
    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubToken: token },
    });

    if (!subscriber) {
      throw new AppError("Invalid unsubscribe link", 400);
    }

    await prisma.subscriber.delete({ where: { id: subscriber.id } });

    return { message: "You have been successfully unsubscribed." };
  }

  async getSubscribers() {
    return prisma.subscriber.findMany({
      where: { isConfirmed: true },
      select: {
        id: true,
        email: true,
        subscribedAt: true,
        confirmedAt: true,
      },
      orderBy: { confirmedAt: "desc" },
    });
  }
}

export const newsletterService = new NewsletterService();
