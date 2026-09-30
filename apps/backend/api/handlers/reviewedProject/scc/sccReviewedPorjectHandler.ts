import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";


export default class SccReviewedProjectHandler { 
    static async insertReviewedProject(req : Request, res : Response) {
        try {
            const schema = z.object({ 
                project_id: z.number(),
                is_recommended: z.number(),
                feedback: z.string().optional() 
            });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = validationResult.data;
            if(params.is_recommended == 1 || params.is_recommended == 0) {
                await prisma.reviewedProject.create({
                    data: {
                        project_id: params.project_id,
                        is_recommended: params.is_recommended,
                        feedback: params.feedback ?? "",
                        created_at: new Date()
                    }
                });
            }

            await prisma.projectDetail.update({
                where: { project_id: params.project_id },
                data: { status_id: 3 }
            });
        
            sendSuccessResponse(res, "Project Successfully Reviewed");
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }
}