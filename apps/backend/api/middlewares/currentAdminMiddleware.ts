import type { RequestHandler } from "express";
import { getLocalRoles, verifyToken } from "../utils/auth/auth.js";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const currentAdminMiddleware: RequestHandler = async (req, res, next) => {
  const cookieToken = req.cookies?.[process.env.COOKIE_NAME ?? "gitbee_token"];
  const bearerToken = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const verified = verifyToken(cookieToken || bearerToken || "");
  const payload = verified.data;
  if (!verified.status) {
    return sendErrorResponse(res, "Unauthorized", 401);
  }
  try {
    const currentSession = await resolveCurrentSession(payload);
    if (currentSession.status !== "current") {
      return sendErrorResponse(res, "Unauthorized", 401);
    }
    if (!getLocalRoles(currentSession.user).includes("Admin")) {
      return sendErrorResponse(res, "Forbidden", 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
