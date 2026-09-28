import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class MajorHandler {
    static async getAllMajor(req : Request, res : Response, next : NextFunction) {
        try {
            const majors = await prisma.major.findMany();
            sendSuccessResponse(res, majors);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async insertMajor(req : Request, res : Response, next : NextFunction) {
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
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }
}