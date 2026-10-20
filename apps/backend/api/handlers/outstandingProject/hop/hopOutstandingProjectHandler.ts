import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";


export default class HopOutstandingProjectHandler { 
    static async insertOutstandingProject(req : Request, res : Response) {
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
                        feedback: params.feedback ?? "",
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
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }
}