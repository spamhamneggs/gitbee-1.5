import { z } from "zod";
import { parseJwt } from "../../utils/auth/auth.js";
import type { Request, Response } from "express";
import { createToken } from "../../utils/auth/auth.js";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse } from "../../utils/response/response.js";
import GenericService from "../../services/generic/genericService.js";
import type { AtlantisAccountData } from "../../services/generic/genericService.js";
import { prisma } from "../../prisma/client.js";


export default class AuthHandler {
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

            const nim = user?.role != null
                ? user.lecturer_code ?? user.student_id ?? user.binusian_id ?? ""
                : (atlantisAccount?.NIM ?? user?.student_id ?? user?.binusian_id ?? "");

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