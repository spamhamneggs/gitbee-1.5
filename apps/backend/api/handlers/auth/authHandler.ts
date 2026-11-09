import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { createLocalToken, createToken, getLocalNim, getLocalRoles, parseJwt } from "../../utils/auth/auth.js";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse, ServiceError } from "../../utils/response/response.js";
import { isSsoBypassEnabled } from "../../utils/auth/devBypass.js";
import AuthService from "../../services/auth/authService.js";

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

export default class AuthHandler {
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
            return sendSuccessResponse(res, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    user_type: user.user_type,
                },
                ...localSession(user, roles, roles[0] ?? user.role),
            }, sessionCookie(token));
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
            return sendSuccessResponse(res, localSession(user, roles, valid.data.role), sessionCookie(token));
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
            return sendSuccessResponse(res, localSession(user, roles, roles[0]), sessionCookie(token));
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

            return sendSuccessResponse(res, {
                nim: nim,
                BinusianId: username,
                Name: name.toUpperCase(),
                Email: email.toLowerCase(),
                Role: roles,
                ActiveRole: activeRole,
                MicrosoftToken: microsoftToken
            }, {
                name: ssoCookieName,
                value: token.token,
                expires: token.expires,
            });
        } catch (error) {
            if (error instanceof ServiceError) {
                return sendErrorResponse(res, error.message, error.status);
            }
            return sendErrorResponse(res, getErrorMessage(error), 400);
        }
    }
}
