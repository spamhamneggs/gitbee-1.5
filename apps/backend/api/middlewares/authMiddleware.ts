import type { Request, Response, NextFunction } from "express";
import { resolveCurrentSession } from "../utils/auth/currentSession.js";
import { rejectSession, verifyToken } from "../utils/auth/auth.js";

export const AuthMiddleware = () => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const cookieName = process.env.COOKIE_NAME ?? "gitbee_token";
        const cookieToken = cookieName ? req.cookies?.[cookieName] : undefined;
        const authorization = req.get("authorization");
        const bearerToken = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
        const token = cookieToken || bearerToken;

        if (!token) {
            return rejectSession(req, res);
        }
          
        const verify = verifyToken(token);
        if (!verify.status || !verify.data) {
            return rejectSession(req, res);
        }

        try {
            const currentSession = await resolveCurrentSession(verify.data);
            if (currentSession.status === "invalid") {
                return rejectSession(req, res);
            }
            res.locals.authPayload = verify.data;
            next();
        } catch (error) {
            next(error);
        }
    }
}
