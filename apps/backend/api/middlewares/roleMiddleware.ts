import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const RoleMiddleware = (requiredRole: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const cookieName = process.env.COOKIE_NAME;
        if (!cookieName) {
            return sendErrorResponse(res, "Cookie name is not configured", 500);
        }
        const cookies = req.cookies;
        const token = cookies[cookieName];
        if (!token) {
            return sendErrorResponse(res, "Cookie not found", 401);
        }
          
        const verify = verifyToken(token);
        if (!verify.status) {
            return sendErrorResponse(res, verify.data, 401);
        }
          
        const data = verify.data;

        if (!data) {
            return sendErrorResponse(res, "Forbidden", 401);
        }

        const role = typeof data === "object" && "role" in data ? data.role : undefined;
        if (!role) {
            return sendErrorResponse(res, "User role not found", 401);
        }
          
        if (role !== requiredRole) {
            return sendErrorResponse(res, "Forbidden", 401);
        }
          
        next();
    }
}