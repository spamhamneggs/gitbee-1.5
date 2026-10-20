import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import GenericService from "../../services/generic/genericService.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class UserHandler {
    static async getName(req: Request<{ nim: string }>, res: Response) {
        const schema = z.object({ nim: z.string() })

        const validationResult = validateSchema(schema, req.query);
        if (validationResult.error) {
            return sendErrorResponse(res, validationResult.details, 400);
        }
    
        const params = validationResult.data;
        const result = await GenericService.getName(params.nim);
    
        if (result.status === true && result.data) {
            sendSuccessResponse(res, result.data);
        } else {
            sendErrorResponse(res, result.errors ? result.errors : "Fetch Failed");
        }
    }

    static async getAllRole(req: Request, res: Response) {
        try {
            const roles = await prisma.role.findMany();
            sendSuccessResponse(res, roles);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }    
}