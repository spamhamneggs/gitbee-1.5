import type { Request, Response, NextFunction } from "express";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { getVerifiedAuthClaims, rejectSession } from "../utils/auth/auth.js";

export const AuthMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const claims = getVerifiedAuthClaims(req);
    if (!claims) {
      return rejectSession(req, res);
    }

    try {
      const currentSession = await resolveCurrentSession(claims);
      if (currentSession.status === "invalid") {
        return rejectSession(req, res);
      }
      res.locals.authPayload = claims;
      next();
    } catch (error) {
      next(error);
    }
  };
}
