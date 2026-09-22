import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class AdminCategoryHandler {
    static async insertCategory(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({ name: z.string() });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = {
                name: validationResult.data.name
            };
    
            const newCategory = await prisma.category.create({
                data: {
                    name: params.name
                },
            });
    
            sendSuccessResponse(res, newCategory);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }

    static async updateCategory(req : Request, res : Response, next : NextFunction) {
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
    
            const updatedCategory = await prisma.category.update({
                where: {
                    id: Number(params.id)
                },
                data: {
                    name: params.name
                }
            });
    
            sendSuccessResponse(res, updatedCategory);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Update Failed");
        }
    }
}