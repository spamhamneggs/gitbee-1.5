import type { Request, Response, NextFunction } from "express";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { verifyToken } from "../utils/auth/auth.js";
import { sendErrorResponse } from "../utils/response/response.js";

export const AuthMiddleware = () => {
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

        try {
            const currentSession = await resolveCurrentSession(verify.data);
            if (currentSession.status === "invalid") {
                return sendErrorResponse(res, "Unauthorized", 401);
            }
            next();
        } catch (error) {
            next(error);
        }
    }
}