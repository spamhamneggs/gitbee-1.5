import { z } from "zod";
import { parseJwt } from "api/utils/auth/auth";
import type { Request, Response } from "express";
import { createToken } from "api/utils/auth/auth";
import { sendSuccessResponse, sendErrorResponse } from "api/utils/response/response";
import GenericService from "api/services/generic/genericService";
import { prisma } from "api/prisma/client";


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

            const username = atlantis.data.BinusianID ?? "";
            const lecturer_code = atlantis.data.KodeDosen ?? "";

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

            const nim = user?.role != null ? user?.lecturer_code : atlantis.data.NIM;

            let activeRole = null;
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

            return sendSuccessResponse(res, {
                nim: nim,
                BinusianId: username,
                Name: name.toUpperCase(),
                Email: email.toLowerCase(),
                Role: role,
                ActiveRole: activeRole,
                MicrosoftToken: microsoftToken
            }, {
                name: process.env.COOKIE_NAME,
                value: token.token,
                expires: token.expires,
            });
        } catch (error) {
            return sendErrorResponse(res, error.message, 400);
        }
    }
}