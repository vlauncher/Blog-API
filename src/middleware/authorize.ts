import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/app-error.js";

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const userRole = req.user.role || "READER";
    if (!allowedRoles.includes(userRole)) {
      throw new AppError("You do not have permission to perform this action", 403);
    }

    next();
  };
};
