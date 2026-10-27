import type { Request, Response, NextFunction } from "express";
import { getLocalRoles, verifyToken } from "../utils/auth/auth.js";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const RoleMiddleware = (requiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {

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

    const matchesRole = (value: unknown): boolean => {
      if (Array.isArray(value)) {
        return value.some(matchesRole);
      }
      if (typeof value === "string") {
        return value.split(/[,\s]+/).includes(requiredRole);
      }
      return false;
    };

    try {
      const currentSession = await resolveCurrentSession(verify.data);
      if (currentSession.status === "invalid") {
        return sendErrorResponse(res, "Unauthorized", 401);
      }

      if (currentSession.status === "current") {
        if (!getLocalRoles(currentSession.user).includes(requiredRole)) {
          return sendErrorResponse(res, "Forbidden", 403);
        }
      } else {
        const roles: unknown[] = [];
        if (typeof verify.data === "object" && verify.data !== null) {
          if ("role" in verify.data) roles.push(verify.data.role);
          if ("roles" in verify.data) roles.push(verify.data.roles);
        }
        if (!roles.some(matchesRole)) {
          return sendErrorResponse(res, "Forbidden", 403);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};