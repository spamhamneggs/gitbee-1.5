import { z } from "zod";
import { parseJwt } from "../../utils/auth/auth.js";
import type { NextFunction, Request, Response } from "express";
import { createLocalToken, createToken, getLocalNim, getLocalRoles } from "../../utils/auth/auth.js";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse } from "../../utils/response/response.js";
import GenericService from "../../services/generic/genericService.js";
import type { AtlantisAccountData } from "../../services/generic/genericService.js";
import { prisma } from "../../prisma/client.js";
import { hashPassword, verifyPassword } from "../../utils/auth/password.js";

const DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$Z2l0YmVlLWxvY2FsLWxvZ2luLWR1bW15LXNhbHQ=$wFAFffXSmSnjf95eUXNLQGx6IOgpXcbt/0yauPvSta/wt3Y85e6A9x17lhMJV8LyAqARq+3zt0t6doSwyqIfeA==";

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

            const email = valid.data.email.toLowerCase();
            const user = await prisma.user.findUnique({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    user_type: true,
                    student_id: true,
                    binusian_id: true,
                    lecturer_code: true,
                },
            });
            if (!user) {
                await verifyPassword(valid.data.password, DUMMY_PASSWORD_HASH);
                return sendErrorResponse(res, "Invalid email or password", 401);
            }

            // The shared Prisma client masks User.password in query results.
            const credentials = await prisma.$queryRaw<Array<{ password: string | null }>>`
                SELECT password FROM user WHERE email = ${user.email} LIMIT 1
            `;
            const passwordHash = credentials[0]?.password;
            if (!passwordHash) {
                await verifyPassword(valid.data.password, DUMMY_PASSWORD_HASH);
                return sendErrorResponse(res, "Invalid email or password", 401);
            }
            if (!(await verifyPassword(valid.data.password, passwordHash))) {
                return sendErrorResponse(res, "Invalid email or password", 401);
            }

            const roles = getLocalRoles(user);
            if (roles.length === 0) {
                return sendErrorResponse(res, "Invalid local account role", 403);
            }
            const activeRole = roles[0] ?? user.role;
            const token = createLocalToken(user);
            return sendSuccessResponse(res, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    user_type: user.user_type,
                },
                nim: getLocalNim(user),
                Name: user.name.toUpperCase(),
                Email: user.email,
                Role: roles,
                ActiveRole: activeRole,
                MicrosoftToken: "",
            }, {
                name: process.env.COOKIE_NAME ?? "gitbee_token",
                value: token.token,
                expires: token.expires,
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

            const userId = res.locals.localUserId as number;

            const credentials = await prisma.$queryRaw<Array<{ password: string | null }>>`
                SELECT password FROM user WHERE id = ${userId} LIMIT 1
            `;
            const passwordHash = credentials[0]?.password;
            if (!passwordHash || !(await verifyPassword(valid.data.currentPassword, passwordHash))) {
                return sendErrorResponse(res, "Invalid current password", 401);
            }

            await prisma.user.update({
                where: { id: userId },
                data: { password: await hashPassword(valid.data.newPassword) },
            });
            return sendSuccessResponse(res, { message: "Password updated successfully" });
        } catch (error) {
            return next(error);
        }
    }

    static async changeLocalRole(req: Request, res: Response, next: NextFunction) {
        try {
            const valid = z.object({ role: z.string().min(1) }).safeParse(req.body);
            if (!valid.success) {
                return sendErrorResponse(res, "Invalid role", 400);
            }
            const user = await prisma.user.findUnique({
                where: { id: res.locals.localUserId as number },
                select: {
                    id: true, email: true, name: true, role: true, user_type: true,
                    student_id: true, binusian_id: true, lecturer_code: true,
                },
            });
            if (!user) return sendErrorResponse(res, "Unauthorized", 401);
            const roles = getLocalRoles(user);
            if (!roles.includes(valid.data.role)) {
                return sendErrorResponse(res, "Forbidden", 403);
            }
            const token = createLocalToken(user, valid.data.role);
            return sendSuccessResponse(res, {
                nim: getLocalNim(user),
                Name: user.name.toUpperCase(),
                Email: user.email,
                Role: roles,
                ActiveRole: valid.data.role,
                MicrosoftToken: "",
            }, {
                name: process.env.COOKIE_NAME ?? "gitbee_token",
                value: token.token,
                expires: token.expires,
            });
        } catch (error) {
            return next(error);
        }
    }

    static async login(req: Request, res: Response) {

        const isDev = process.env.NODE_ENV === "development";
        const isBypassActive = process.env.BYPASS_SSO === "true";

        if (isDev && isBypassActive) {
            console.log("[SSO BYPASS] Active. Generating local dummy session...");
            const dummyEmail = "admin@dummy.gitbee";
            const dummyName = "LOCAL ADMIN BYPASS";
            const dummyNim = "D9999";
            const dummyRole = "Admin";
            const cookieName = process.env.COOKIE_NAME || "gitbee_token";

            return sendSuccessResponse(res, {
                nim: dummyNim,
                BinusianId: dummyNim,
                Name: dummyName.toUpperCase(),
                Email: dummyEmail,
                Role: [dummyRole],
                ActiveRole: dummyRole,
                MicrosoftToken: "dummy-microsoft-token-bypass"
            }, {
                name: cookieName,
                value: "dummy-jwt-token-bypass-local", // Nilai cookie di-hardcode
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // Kadaluarsa 1 hari
            });
        }
        
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

            const atlantis = await GenericService.getAtlantisData(email);
            if (atlantis instanceof Error) {
                return sendErrorResponse(res, "Failed to fetch Binusian data", 401);
            }

            const atlantisAccount = atlantis.data as AtlantisAccountData | null;
            const username = atlantisAccount?.BinusianID ?? "";
            const lecturer_code = atlantisAccount?.KodeDosen ?? "";

            const userLookupConditions = [
                { email: email },
                ...(lecturer_code ? [{ lecturer_code }] : []),
                ...(atlantisAccount?.NIM ? [{ student_id: atlantisAccount.NIM }] : []),
                ...(atlantisAccount?.BinusianID ? [{ binusian_id: atlantisAccount.BinusianID }] : []),
            ];

            const user = await prisma.user.findFirst({
                where: {
                    OR: userLookupConditions,
                },
                select: {
                    lecturer_code: true,
                    student_id: true,
                    binusian_id: true,
                    email: true,
                    role: true,
                    user_type: true
                },
            });

            // Students can have user rows too (role "Student", user_type "student"),
            // so a matched row alone doesn't make someone staff.
            const isStaff = user != null && user.role !== "Student" && user.user_type !== "student";

            const role = isStaff
            ? user.role === "Lecturer"
                ? ["Lecturer"]
                : [user.role, "Lecturer"]
            : ["Student"];

            let nim: string;

            if (isStaff) {
                nim = user?.lecturer_code ?? "";
            } else if (user) {
                // A student account must carry its NIM. binusian_id is NOT a NIM and
                // cannot substitute for it: downstream student class/group queries
                // match on the NIM, so a wrong value silently returns no data.
                if (!user.student_id) {
                    return sendErrorResponse(res, "Student account is missing its student_id (NIM). Please contact an administrator.", 401);
                }
                nim = user.student_id;
            } else {
                // No local user row yet (students are not guaranteed one): fall back to
                // Atlantis until every student account has been backfilled with a student_id.
                nim = atlantisAccount?.NIM ?? "";
            }

            let activeRole: string | undefined;
            if (valid.data.role) {
                // Only allow switching to a role this user actually has.
                if (role.includes(valid.data.role)) {
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
                role,
                microsoftToken,
                "",
                activeRole,
            );

            const cookieName = process.env.COOKIE_NAME;
            if (!cookieName) {
                return sendErrorResponse(res, "Cookie name is not configured", 500);
            }

            return sendSuccessResponse(res, {
                nim: nim,
                BinusianId: username,
                Name: name.toUpperCase(),
                Email: email.toLowerCase(),
                Role: role,
                ActiveRole: activeRole,
                MicrosoftToken: microsoftToken
            }, {
                name: cookieName,
                value: token.token,
                expires: token.expires,
            });
        } catch (error) {
            return sendErrorResponse(res, getErrorMessage(error), 400);
        }
    }
}
