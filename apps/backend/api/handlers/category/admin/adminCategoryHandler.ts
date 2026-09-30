import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";


export default class AdminCategoryHandler {
    static async insertCategory(req : Request, res : Response) {
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
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }

    static async updateCategory(req : Request, res : Response) {
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
            sendErrorResponse(res, getErrorMessage(error, "Update Failed"));
        }
    }
}