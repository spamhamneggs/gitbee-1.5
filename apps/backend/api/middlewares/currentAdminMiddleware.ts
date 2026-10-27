import type { RequestHandler } from "express";
import { prisma } from "../prisma/client.js";
import { getLocalRoles, verifyToken } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const currentAdminMiddleware: RequestHandler = async (req, res, next) => {
  const cookieToken = req.cookies?.[process.env.COOKIE_NAME ?? "gitbee_token"];
  const bearerToken = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const verified = verifyToken(cookieToken || bearerToken || "");
  const payload = verified.data;
  if (
    !verified.status ||
    typeof payload !== "object" ||
    payload === null ||
    !("userId" in payload) ||
    typeof payload.userId !== "number" ||
    !Number.isSafeInteger(payload.userId) ||
    payload.userId <= 0
  ) {
    return sendErrorResponse(res, "Unauthorized", 401);
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, user_type: true },
    });
    if (!user) {
      return sendErrorResponse(res, "Unauthorized", 401);
    }
    if (!getLocalRoles(user).includes("Admin")) {
      return sendErrorResponse(res, "Forbidden", 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};
