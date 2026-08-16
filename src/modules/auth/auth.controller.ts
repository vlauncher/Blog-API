import type { Request, Response } from "express";
import { authService } from "./auth.service.js";
import {
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema.js";

export const register = async (req: Request, res: Response): Promise<void> => {
  const validated = registerSchema.parse({ body: req.body });
  const result = await authService.register(validated.body);
  res.status(201).json({ status: "success", ...result });
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const validated = verifyEmailSchema.parse({ body: req.body });
  const result = await authService.verifyEmail(validated.body);
  res.status(200).json({ status: "success", ...result });
};

export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const validated = resendOtpSchema.parse({ body: req.body });
  const result = await authService.resendOtp(validated.body);
  res.status(200).json({ status: "success", ...result });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const validated = loginSchema.parse({ body: req.body });
  const result = await authService.login(validated.body);
  res.status(200).json({ status: "success", ...result });
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const validated = refreshTokenSchema.parse({ body: req.body });
  const result = await authService.refreshToken(validated.body.refreshToken);
  res.status(200).json({ status: "success", ...result });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const refreshTokenStr = req.body?.refreshToken;
  const result = await authService.logout(userId, refreshTokenStr);
  res.status(200).json({ status: "success", ...result });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const validated = forgotPasswordSchema.parse({ body: req.body });
  const result = await authService.forgotPassword(validated.body);
  res.status(200).json({ status: "success", ...result });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const validated = resetPasswordSchema.parse({ body: req.body });
  const result = await authService.resetPassword(validated.body);
  res.status(200).json({ status: "success", ...result });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const validated = changePasswordSchema.parse({ body: req.body });
  const result = await authService.changePassword(userId, validated.body);
  res.status(200).json({ status: "success", ...result });
};
