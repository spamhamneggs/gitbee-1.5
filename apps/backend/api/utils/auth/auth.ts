import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import { getErrorMessage } from "../response/response.js"
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
        microsoftToken: microsoftToken
    }, secret);
    return {
        token,
        expires: addHour(168),
    }
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
