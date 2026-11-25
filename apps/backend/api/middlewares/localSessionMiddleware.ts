import type { RequestHandler } from "express";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { getVerifiedAuthClaims } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const localSessionMiddleware: RequestHandler = async (req, res, next) => {
  const claims = getVerifiedAuthClaims(req);
  if (!claims || claims.userId === undefined) {
    return sendErrorResponse(res, "Unauthorized", 401);
  }
  try {
    const currentSession = await resolveCurrentSession(claims);
    if (currentSession.status !== "current") {
      return sendErrorResponse(res, "Unauthorized", 401);
    }
    res.locals.localUserId = currentSession.user.id;
    res.locals.authPayload = claims;
    res.locals.localActiveRole = claims.activeRole;
    next();
  } catch (error) {
    next(error);
  }
};
