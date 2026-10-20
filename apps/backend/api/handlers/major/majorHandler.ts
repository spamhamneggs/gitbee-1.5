import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class MajorHandler {
    static async getAllMajor(req : Request, res : Response) {
        try {
            const majors = await prisma.major.findMany();
            sendSuccessResponse(res, majors);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

    static async insertMajor(req : Request, res : Response) {
        try {
            const schema = z.object({ name: z.string() });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = {
                name: validationResult.data.name
            };
    
            const newMajor = await prisma.major.create({
                data: {
                    name: params.name
                },
            });
    
            sendSuccessResponse(res, newMajor);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }
}