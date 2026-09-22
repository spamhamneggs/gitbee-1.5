import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class AdminTechnologyHandler {

    static async insertTechnology(req : Request, res : Response) {
        try {
            const schema = z.object({ name: z.string() });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = {
                name: validationResult.data.name
            };
    
            const newTechnology = await prisma.technology.create({
                data: {
                    name: params.name
                },
            });
    
            sendSuccessResponse(res, newTechnology);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }

    static async updateTechnology(req : Request, res : Response) {
        try {
            const schema = z.object({ 
                id: z.string(), 
                name: z.string() 
            });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = validationResult.data;
    
            const updatedTechnology = await prisma.technology.update({
                where: {
                    id: Number(params.id)
                },
                data: {
                    name: params.name
                }
            });
    
            sendSuccessResponse(res, updatedTechnology);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Update Failed");
        }
    }
}