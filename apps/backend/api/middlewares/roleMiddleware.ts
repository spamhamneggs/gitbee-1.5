import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const RoleMiddleware = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {

    const isDev= process.env.NODE_ENV === "development";
    const isBypassActive = process.env.BYPASS_SSO === "true";

    if(isDev && isBypassActive){
        return next();
    }
    
    const cookieName = process.env.COOKIE_NAME ?? "gitbee_token";
    const cookieToken = cookieName ? req.cookies?.[cookieName] : undefined;
    const authorization = req.get("authorization");
    const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const token = cookieToken || bearerToken;

    if (!token) {
      return sendErrorResponse(res, "Unauthorized", 401);
    }

    const verify = verifyToken(token);
    if (!verify.status || !verify.data) {
      return sendErrorResponse(res, "Forbidden", 401);
    }

    const roles: unknown[] = [];
    if (typeof verify.data === "object" && verify.data !== null) {
      if ("role" in verify.data) {
        roles.push(verify.data.role);
      }
      if ("roles" in verify.data) {
        roles.push(verify.data.roles);
      }
    }

    const matchesRole = (value: unknown): boolean => {
      if (Array.isArray(value)) {
        return value.some(matchesRole);
      }
      if (typeof value === "string") {
        return value.split(/[,\s]+/).includes(requiredRole);
      }
      return false;
    };

    if (!roles.some(matchesRole)) {
      return sendErrorResponse(res, "Forbidden", 403);
    }

    next();
  };
};