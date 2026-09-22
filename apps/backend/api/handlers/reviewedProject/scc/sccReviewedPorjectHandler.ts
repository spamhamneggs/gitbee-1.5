import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class SccReviewedProjectHandler { 
    static async insertReviewedProject(req : Request, res : Response, next : NextFunction) {
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
                        feedback: params.feedback,
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
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }
}