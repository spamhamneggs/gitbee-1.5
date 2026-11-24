import type { RequestHandler } from "express";
import { getLocalRoles, getVerifiedAuthClaims } from "../utils/auth/auth.js";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const currentAdminMiddleware: RequestHandler = async (req, res, next) => {
  const claims = getVerifiedAuthClaims(req);
  if (!claims) {
    return sendErrorResponse(res, "Unauthorized", 401);
  }
  try {
    const currentSession = await resolveCurrentSession(claims);
    if (currentSession.status !== "current") {
      return sendErrorResponse(res, "Unauthorized", 401);
    }
    if (!getLocalRoles(currentSession.user).includes("Admin")) {
      return sendErrorResponse(res, "Forbidden", 403);
    }
    res.locals.authPayload = claims;
    next();
  } catch (error) {
    next(error);
  }
};
