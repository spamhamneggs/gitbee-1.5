import type { RequestHandler } from "express";
import { prisma } from "../prisma/client.js";
import { verifyToken } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const localSessionMiddleware: RequestHandler = async (req, res, next) => {
    const cookieToken = req.cookies?.[process.env.COOKIE_NAME ?? "gitbee_token"];
    const bearerToken = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const verified = verifyToken(cookieToken || bearerToken || "");
    const payload = verified.data;
    if (!verified.status || typeof payload !== "object" || payload === null ||
        !("userId" in payload) || typeof payload.userId !== "number" ||
        !Number.isSafeInteger(payload.userId) || payload.userId <= 0) {
        return sendErrorResponse(res, "Unauthorized", 401);
    }
    const tokenVersion = "credentialVersion" in payload
        ? payload.credentialVersion
        : 0;
    if (typeof tokenVersion !== "number" || !Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
        return sendErrorResponse(res, "Unauthorized", 401);
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, credential_version: true },
        });
        if (!user || user.credential_version !== tokenVersion) {
            return sendErrorResponse(res, "Unauthorized", 401);
        }
        res.locals.localUserId = user.id;
        next();
    } catch (error) {
        next(error);
    }
};
