import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { createLocalToken, createRoleToken, createToken, getLocalNim, getLocalRoles, parseJwt, verifyToken } from "../../utils/auth/auth.js";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse, ServiceError } from "../../utils/response/response.js";
import { isSsoBypassEnabled } from "../../utils/auth/devBypass.js";
import AuthService from "../../services/auth/authService.js";
import type { SessionUser } from "../../utils/auth/currentSession.js";

type LocalUser = NonNullable<Awaited<ReturnType<typeof AuthService.findLocalUser>>>;

const cookieName = () => process.env.COOKIE_NAME ?? "gitbee_token";

/** The login payload the frontend stores for a local (non-SSO) session. */
const localSession = (user: LocalUser, roles: string[], activeRole: string | undefined) => ({
    nim: getLocalNim(user),
    Name: user.name.toUpperCase(),
    Email: user.email,
    Role: roles,
    ActiveRole: activeRole,
    MicrosoftToken: "",
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

function readSession(claims: unknown, user?: SessionUser) {
    const parsed = sessionSchema.safeParse(claims);
    if (!parsed.success) return null;
    const payload = parsed.data;
    const authMethod = payload.authMethod ?? (payload.microsoftToken ? "sso" : "local");
    // SSO can match the local account by NIM, lecturer code or Binusian ID.
    const allowsEmailAlias = authMethod === "sso" && user !== undefined && payload.userId === user.id;
    const roles = user ? getLocalRoles(user) : payload.role;
    const activeRole = payload.activeRole ?? roles[0];
    if (!activeRole || !roles.includes(activeRole)) return null;
    // Returning refreshed roles with an old NIM or cookie membership would
    // disagree with submission checks and the Next navigation guard.
    if (user && (payload.nim !== getLocalNim(user) ||
        (!allowsEmailAlias && payload.email.toLowerCase() !== user.email.toLowerCase()) ||
        roles.length !== payload.role.length || roles.some((role) => !payload.role.includes(role)))) {
        return null;
    }
    return {
        nim: payload.nim,
        name: payload.name,
        email: payload.email,
        activeRole,
        roles,
        authMethod,
    };
}

function sendSessionResponse(res: Response, legacyData: Record<string, unknown>, token: { token: string; expires: Date }) {
    const session = readSession(verifyToken(token.token).data);
    if (!session) return sendErrorResponse(res, "Unauthorized", 401);
    res.set("Cache-Control", "no-store");
    return sendSuccessResponse(res, { ...legacyData, session }, {
        name: process.env.COOKIE_NAME ?? "gitbee_token",
        value: token.token,
        expires: token.expires,
    });
}

export default class AuthHandler {
    static session(_req: Request, res: Response) {
        const session = readSession(res.locals.authPayload, res.locals.authUser);
        if (!session) return sendErrorResponse(res, "Unauthorized", 401);
        return sendSuccessResponse(res, session);
    }

    static changeSessionRole(req: Request, res: Response) {
        const valid = z.object({ role: z.string().min(1) }).safeParse(req.body);
        if (!valid.success) return sendErrorResponse(res, "Invalid role", 400);
        const session = readSession(res.locals.authPayload, res.locals.authUser);
        if (!session) return sendErrorResponse(res, "Unauthorized", 401);
        if (!session.roles.includes(valid.data.role)) return sendErrorResponse(res, "Forbidden", 403);
        const token = createRoleToken(res.locals.authPayload, valid.data.role, session.authMethod);
        return sendSessionResponse(res, {}, token);
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
            return sendSessionResponse(res, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    user_type: user.user_type,
                },
                ...localSession(user, roles, roles[0] ?? user.role),
            }, token);
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

    static async changeLocalRole(req: Request, res: Response, next: NextFunction) {
        try {
            const valid = z.object({ role: z.string().min(1) }).safeParse(req.body);
            if (!valid.success) {
                return sendErrorResponse(res, "Invalid role", 400);
            }
            const user = await AuthService.findLocalUser(res.locals.localUserId as number);
            if (!user) return sendErrorResponse(res, "Unauthorized", 401);
            const roles = getLocalRoles(user);
            if (!roles.includes(valid.data.role)) {
                return sendErrorResponse(res, "Forbidden", 403);
            }
            const token = createLocalToken(user, valid.data.role);
            return sendSessionResponse(res, localSession(user, roles, valid.data.role), token);
        } catch (error) {
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
            return sendSessionResponse(res, localSession(user, roles, roles[0]), token);
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

            const ssoCookieName = process.env.COOKIE_NAME;
            if (!ssoCookieName) {
                return sendErrorResponse(res, "Cookie name is not configured", 500);
            }

            return sendSessionResponse(res, {
                nim: nim,
                BinusianId: username,
                Name: name.toUpperCase(),
                Email: email.toLowerCase(),
                Role: roles,
                ActiveRole: activeRole,
                MicrosoftToken: microsoftToken
            }, token);
        } catch (error) {
            if (error instanceof ServiceError) {
                return sendErrorResponse(res, error.message, error.status);
            }
            return sendErrorResponse(res, getErrorMessage(error), 400);
        }
    }
}
