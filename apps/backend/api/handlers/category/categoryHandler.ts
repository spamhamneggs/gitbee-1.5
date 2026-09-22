import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class CategoryHandler {
    static async getAllCategory(req : Request, res : Response, next : NextFunction) {
        try {
            const categories = await prisma.category.findMany();
            sendSuccessResponse(res, categories);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}