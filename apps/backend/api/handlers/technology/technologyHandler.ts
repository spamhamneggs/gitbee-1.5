import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class TechnologyHandler {
    static async getAllTechnology(req : Request, res : Response) {
        try {
            const technologies = await prisma.technology.findMany();
            sendSuccessResponse(res, technologies);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async getTechnology(req: Request, res: Response) {
        try {
            const schema = z.object({
                id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }
            
            const params = validationResult.data;
            const technology = await prisma.technology.findUnique({
                where: {
                    id: Number(params.id)
                }
            });
    
            if (!technology) {
                return sendErrorResponse(res, "Technology not found");
            }
    
            sendSuccessResponse(res, technology);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }    
}