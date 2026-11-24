import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import type { Request, Response } from "express"
import { getErrorMessage, sendErrorResponse } from "../response/response.js"
dotenv.config()
const secret = process.env.JWT_SECRET
if (!secret) {
    throw new Error("JWT_SECRET is not configured")
}

const addHour = (hour: number) => {
    const now = new Date();
    now.setTime(now.getTime() + (hour * 60 * 60 * 1000))
    return now;
}
export const createToken = (
    nim: string,
    username: string,
    name: string,
    email: string,
    role: string[],
    microsoftToken: string,
    messier_id?: string,
    activeRole?: string,
    userId?: number,
    credentialVersion = 0,
    ) => {
    const expire = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7);
    const token = jwt.sign({
        exp: expire,
        nim: nim,
        role: role,
        binusianId: username,
        name: name.toUpperCase(),
        email: email.toLowerCase(),
        messier_id: messier_id,
        activeRole: activeRole,
        authMethod: "sso",
        ...(userId !== undefined ? { userId, credentialVersion } : {}),
        microsoftToken: microsoftToken
    }, secret);
    return {
        token,
        expires: addHour(168),
    }
}

// utils/auth/localAccountSql.ts repeats these rules in SQL for the admin
// account lists, and tests/localAccountSql.mysql.test.ts checks that the two
// agree. Change them together.
export const getLocalRoles = (user: {
    role: string;
    user_type: string | null;
}): string[] => {
    if (isLocalStudent(user)) {
        return ["Student"];
    }
    if ((user.user_type !== null && user.user_type.trim().toLowerCase() !== "staff") ||
        !["Lecturer", "Admin", "SCC", "HoP"].includes(user.role)) {
        return [];
    }
    if (user.role === "Lecturer") {
        return ["Lecturer"];
    }
    return [user.role, "Lecturer"];
}

function isLocalStudent(user: { role: string; user_type: string | null }): boolean {
    return user.role === "Student" || user.user_type?.trim().toLowerCase() === "student";
}

export const getLocalNim = (user: {
    role: string;
    user_type: string | null;
    student_id: string | null;
    lecturer_code: string | null;
}): string => {
    return isLocalStudent(user) ? user.student_id ?? "" : user.lecturer_code ?? "";
}

export const createLocalToken = (user: {
    id: number;
    email: string;
    name: string;
    role: string;
    user_type: string | null;
    student_id: string | null;
    binusian_id: string | null;
    lecturer_code: string | null;
    credential_version?: number;
}, activeRole?: string): { token: string; expires: Date } => {
    const expire = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7);
    const roles = getLocalRoles(user);
    if (roles.length === 0 || (activeRole !== undefined && !roles.includes(activeRole))) {
        throw new Error("Invalid local account role");
    }
    return {
        token: jwt.sign({
            exp: expire,
            userId: user.id,
            nim: getLocalNim(user),
            binusianId: user.binusian_id ?? "",
            name: user.name.toUpperCase(),
            email: user.email.toLowerCase(),
            role: roles,
            activeRole: activeRole ?? roles[0],
            authMethod: "local",
            credentialVersion: user.credential_version ?? 0,
            microsoftToken: "",
            user_type: user.user_type,
        }, secret),
        expires: addHour(168),
    };
}

export const verifyToken = (token: string) : {
    status: boolean,
    data: unknown,
} => {
    try {
        const verified = jwt.verify(token, secret);
        return {
            status: true,
            data: verified
        }
    } catch (error) {
        return {
            status: false,
            data: error
        }
    }
}

export interface AuthClaims extends jwt.JwtPayload {
    email: string;
    role: string[];
    userId?: number;
    nim?: string;
}

export const normalizeRoles = (value: unknown): string[] | null => {
    const values = Array.isArray(value) ? value : [value];
    const normalized: string[] = [];
    for (const value of values) {
        if (typeof value !== "string") return null;
        const roles = value.split(",");
        if (roles.some((role) => role.trim() === "")) return null;
        normalized.push(...roles.map((role) => role.trim()));
    }
    return normalized.length > 0 ? [...new Set(normalized)] : null;
}

export const getVerifiedAuthClaims = (req: Request): AuthClaims | null => {
    const cookieName = process.env.COOKIE_NAME ?? "gitbee_token";
    const cookieToken = req.cookies?.[cookieName];
    const bearerToken = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const token = typeof cookieToken === "string" && cookieToken.length > 0
        ? cookieToken
        : bearerToken;
    if (!token) return null;

    const verified = verifyToken(token);
    if (!verified.status || typeof verified.data !== "object" || verified.data === null || Array.isArray(verified.data)) {
        return null;
    }

    const payload = verified.data as jwt.JwtPayload;
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const userId = payload.userId;
    const hasValidUserId = typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0;
    const hasValidNim = typeof payload.nim === "string" && payload.nim.trim() !== "";
    if (!hasValidEmail || (userId !== undefined && !hasValidUserId) || (!hasValidUserId && !hasValidNim)) {
        return null;
    }

    const roleClaim = payload.role ?? payload.roles;
    const role = normalizeRoles(roleClaim);
    if (!role) return null;

    return { ...payload, email, role, ...(hasValidUserId ? { userId } : {}) };
}

export const rejectSession = (req: Request, res: Response) => {
    const cookieName = process.env.COOKIE_NAME ?? "gitbee_token";
    if (req.cookies?.[cookieName] !== undefined) {
        res.clearCookie(cookieName, { path: "/" });
    }
    return sendErrorResponse(res, "Unauthorized", 401);
};

// Only use claims from a verified session. Choosing a role keeps its original expiry.
export const createRoleToken = (
    payload: jwt.JwtPayload & { exp: number },
    role: string,
    authMethod: "sso" | "local",
) => ({
    token: jwt.sign({ ...payload, activeRole: role, authMethod }, secret),
    expires: new Date(payload.exp * 1000),
});

export interface MicrosoftTokenPayload {
    preferred_username?: string;
    unique_name?: string;
    name?: string;
}

export const parseJwt = (token: string): MicrosoftTokenPayload => {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || typeof decoded === "string") {
            throw new Error("Invalid token");
        }
        return decoded as MicrosoftTokenPayload;
    } catch (error) {
        throw new Error(`Failed to parse token: ${getErrorMessage(error, "unknown error")}`, { cause: error });
    }
}
