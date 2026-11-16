import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { createLocalToken, createRoleToken, createToken, getLocalNim, getLocalRoles, parseJwt, rejectSession } from "../../utils/auth/auth.js";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse, ServiceError } from "../../utils/response/response.js";
import { isSsoBypassEnabled } from "../../utils/auth/devBypass.js";
import AuthService from "../../services/auth/authService.js";

type LocalUser = NonNullable<Awaited<ReturnType<typeof AuthService.findLocalUser>>>;

const cookieName = () => process.env.COOKIE_NAME ?? "gitbee_token";

const localSession = (user: LocalUser, roles: string[], activeRole = roles[0]!) => ({
    nim: getLocalNim(user),
    name: user.name.toUpperCase(),
    email: user.email.toLowerCase(),
    roles,
    activeRole,
    authMethod: "local" as const,
});

const sessionCookie = (token: { token: string; expires: Date }) => ({
    name: cookieName(),
    value: token.token,
    expires: token.expires,
});

const sessionSchema = z.object({
    exp: z.number(),
    nim: z.string(),
    name: z.string(),
    email: z.string(),
    userId: z.number().int().positive().optional(),
    role: z.array(z.string()).min(1),
    activeRole: z.string().optional(),
    authMethod: z.enum(["sso", "local"]).optional(),
    microsoftToken: z.string().optional(),
});

function readSession(claims: unknown) {
    const parsed = sessionSchema.safeParse(claims);
    if (!parsed.success) return null;
    const payload = parsed.data;
    const authMethod = payload.authMethod ?? (payload.microsoftToken ? "sso" : "local");
    const roles = payload.role;
    const activeRole = payload.activeRole ?? roles[0];
    if (!activeRole || !roles.includes(activeRole)) return null;
    return {
        nim: payload.nim,
        name: payload.name,
        email: payload.email,
        activeRole,
        roles,
        authMethod,
    };
}

function sendSessionResponse(
    res: Response,
    session: NonNullable<ReturnType<typeof readSession>>,
    token: { token: string; expires: Date },
    legacyData: Record<string, unknown> = {},
) {
    res.set("Cache-Control", "no-store");
    return sendSuccessResponse(res, {
        nim: session.nim,
        Name: session.name,
        Email: session.email,
        Role: session.roles,
        ActiveRole: session.activeRole,
        MicrosoftToken: "",
        ...legacyData,
        session,
    }, sessionCookie(token));
}

export default class AuthHandler {
    static session(req: Request, res: Response) {
        const session = readSession(res.locals.authPayload);
        if (!session) return rejectSession(req, res);
        return sendSuccessResponse(res, session);
    }

    static changeSessionRole(req: Request, res: Response) {
        const valid = z.object({ role: z.string().min(1) }).safeParse(req.body);
        if (!valid.success) return sendErrorResponse(res, "Invalid role", 400);
        const session = readSession(res.locals.authPayload);
        if (!session) return rejectSession(req, res);
        if (!session.roles.includes(valid.data.role)) return sendErrorResponse(res, "Forbidden", 403);
        const token = createRoleToken(res.locals.authPayload, valid.data.role, session.authMethod);
        return sendSessionResponse(res, { ...session, activeRole: valid.data.role }, token);
    }

    static logout(_req: Request, res: Response) {
        res.clearCookie(process.env.COOKIE_NAME ?? "gitbee_token", { path: "/" });
        res.set("Cache-Control", "no-store");
        return sendSuccessResponse(res, { message: "Signed out" });
    }

    static async loginLocal(req: Request, res: Response, next: NextFunction) {
        try {
            const schema = z.object({
                email: z.string().trim().email(),
                password: z.string().min(1).max(1024),
            });
            const valid = schema.safeParse(req.body);
            if (!valid.success) {
                return sendErrorResponse(res, valid.error.issues[0]?.message ?? "Invalid request body", 400);
            }

            const user = await AuthService.verifyLocalLogin(valid.data.email.toLowerCase(), valid.data.password);
            if (!user) {
                return sendErrorResponse(res, "Invalid email or password", 401);
            }

            const roles = getLocalRoles(user);
            if (roles.length === 0) {
                return sendErrorResponse(res, "Invalid local account role", 403);
            }
            const token = createLocalToken(user);
            return sendSessionResponse(res, localSession(user, roles), token, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    user_type: user.user_type,
                },
            });
        } catch (error) {
            return next(error);
        }
    }

    static async changePassword(req: Request, res: Response, next: NextFunction) {
        try {
            const valid = z.object({
                currentPassword: z.string().min(1).max(1024),
                newPassword: z.string().min(8).max(1024),
            }).safeParse(req.body);
            if (!valid.success) {
                return sendErrorResponse(res, valid.error.issues[0]?.message ?? "Invalid request body", 400);
            }

            const user = await AuthService.changePassword(
                res.locals.localUserId as number,
                valid.data.currentPassword,
                valid.data.newPassword
            );
            const roles = getLocalRoles(user);
            if (roles.length === 0) {
                return sendErrorResponse(res, "Invalid local account role", 403);
            }
            const activeRole = roles.includes(res.locals.localActiveRole)
                ? res.locals.localActiveRole
                : roles[0];
            const token = createLocalToken(user, activeRole);
            return sendSuccessResponse(res, { message: "Password updated successfully" }, sessionCookie(token));
        } catch (error) {
            if (error instanceof ServiceError) {
                return sendErrorResponse(res, error.message, error.status);
            }
            return next(error);
        }
    }

    static async loginDevBypass(_req: Request, res: Response) {
        if (!isSsoBypassEnabled()) {
            return sendErrorResponse(res, "Not found", 404);
        }
        try {
            const user = await AuthService.upsertDevBypassUser();
            const roles = getLocalRoles(user);
            if (roles.length === 0) {
                return sendErrorResponse(res, "Invalid local account role", 403);
            }
            const token = createLocalToken(user);
            return sendSessionResponse(res, localSession(user, roles), token);
        } catch (error) {
            // Dev-only route, so hand the cause (e.g. an unmigrated database)
            // to the login page as JSON rather than Express's HTML 500.
            console.error(error);
            const cause = getErrorMessage(error).trim().split("\n").at(-1);
            return sendErrorResponse(res, cause, 500);
        }
    }

    static async login(req: Request, res: Response) {
        const schema = z.object({
            microsoft_token: z.string(),
            role: z.string().optional()
        });

        const valid = schema.safeParse(req.body);
        if (valid.success != true) {
            return sendErrorResponse(res, valid?.error?.issues[0]?.message, 400);
        }

        try {
            const microsoftToken = valid.data.microsoft_token;
            const decodedToken = parseJwt(microsoftToken);

            const email = decodedToken.preferred_username || decodedToken.unique_name;
            const name = decodedToken.name;

            if (!email || !name) {
                return sendErrorResponse(res, "Invalid token: Missing email or name", 400);
            }

            const { user, isStaff, roles, nim, username } = await AuthService.resolveSsoAccount(email);

            let activeRole: string | undefined;
            if (valid.data.role) {
                // Only allow switching to a role this user actually has.
                if (roles.includes(valid.data.role)) {
                    activeRole = valid.data.role;
                } else {
                    return sendErrorResponse(res, "Forbidden", 403);
                }
            } else {
                activeRole = isStaff ? "Lecturer" : "Student";
            }

            const token = createToken(
                nim,
                username,
                name.toLowerCase(),
                email.toLowerCase(),
                roles,
                microsoftToken,
                "",
                activeRole,
                user?.id,
                user?.credential_version ?? 0,
            );

            if (!process.env.COOKIE_NAME) {
                return sendErrorResponse(res, "Cookie name is not configured", 500);
            }

            return sendSessionResponse(res, {
                nim,
                name: name.toUpperCase(),
                email: email.toLowerCase(),
                roles,
                activeRole,
                authMethod: "sso",
            }, token, {
                BinusianId: username,
                MicrosoftToken: microsoftToken
            });
        } catch (error) {
            if (error instanceof ServiceError) {
                return sendErrorResponse(res, error.message, error.status);
            }
            return sendErrorResponse(res, getErrorMessage(error), 400);
        }
    }
}
