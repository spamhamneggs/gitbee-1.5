import type { Request, Response, NextFunction } from "express";
import { getLocalRoles, getVerifiedAuthClaims } from "../utils/auth/auth.js";
import { isUnprovisionedSsoStudent, resolveCurrentSession } from "../utils/auth/currentSession.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const RoleMiddleware = (requiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const claims = getVerifiedAuthClaims(req);
    if (!claims) return sendErrorResponse(res, "Unauthorized", 401);

    try {
      const currentSession = await resolveCurrentSession(claims);
      if (currentSession.status === "invalid") {
        return sendErrorResponse(res, "Unauthorized", 401);
      }
      if (currentSession.status === "untracked" && !isUnprovisionedSsoStudent(claims)) {
        return sendErrorResponse(res, "Unauthorized", 401);
      }

      if (currentSession.status === "current") {
        if (!getLocalRoles(currentSession.user).includes(requiredRole)) {
          return sendErrorResponse(res, "Forbidden", 403);
        }
      } else if (!claims.role.includes(requiredRole)) {
        return sendErrorResponse(res, "Forbidden", 403);
      }

      res.locals.authPayload = claims;
      next();
    } catch (error) {
      next(error);
    }
  };
};
