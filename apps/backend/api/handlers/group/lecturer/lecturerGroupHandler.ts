import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";


export default class LecturerGroupHandler {
    static async removeTemporaryGroup(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                group: z.number()
            });
    
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
                group: params.group
            };
    
            const deletedGroup = await prisma.temporaryGroup.deleteMany({
                where: whereCondition
            });
    
            sendSuccessResponse(res, deletedGroup);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Delete Failed"));
        }
    }
}