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

            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: email }, 
                        { lecturer_code: lecturer_code },
                    ],
                },
                select: {
                    lecturer_code: true,
                    email: true,
                    role: true
                },
            });

            const role = user?.role
            ? user.role === "Lecturer"
                ? ["Lecturer"]
                : [user.role, "Lecturer"]
            : ["Student"];

            const nim = user?.role != null ? user?.lecturer_code : (atlantisAccount?.NIM ?? "");

            let activeRole: string | undefined;
            if (valid.data.role) {
                const checkedUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: email }, 
                            { lecturer_code: lecturer_code },
                        ],
                    },
                    select: {
                        role: true
                    },
                });

                if(checkedUser) {
                    activeRole = valid.data.role;
                }
            } else {
                activeRole = user?.role ? "Lecturer": "Student";
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