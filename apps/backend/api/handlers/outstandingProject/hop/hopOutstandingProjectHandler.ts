import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class HopOutstandingProjectHandler { 
    static async insertOutstandingProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({ 
                project_id: z.number(),
                is_outstanding: z.number(),
                feedback: z.string().optional() 
            });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = validationResult.data;
            if(params.is_outstanding == 1 || params.is_outstanding == 0) {
                await prisma.outstandingProject.create({
                    data: {
                        project_id: params.project_id,
                        is_outstanding: params.is_outstanding,
                        feedback: params.feedback,
                        created_at: new Date()
                    }
                });
            }

            await prisma.projectDetail.update({
                where: { project_id: params.project_id },
                data: { status_id: 4 }
            });
        
            sendSuccessResponse(res, "Project Successfully Finalized");
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }
}