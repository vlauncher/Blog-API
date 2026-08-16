import nodemailer from "nodemailer";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendMail = async ({ to, subject, html, text }: SendMailOptions) => {
  try {
    if (env.NODE_ENV === "test") {
      logger.debug({ to, subject }, "Test mode: Email sending skipped");
      return { messageId: "test-id" };
    }

    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>?/gm, ""),
    });

    logger.info({ to, messageId: info.messageId }, "Email sent successfully");
    return info;
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
    throw err;
  }
};
