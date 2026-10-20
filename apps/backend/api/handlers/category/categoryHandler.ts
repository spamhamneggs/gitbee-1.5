import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class CategoryHandler {
    static async getAllCategory(req : Request, res : Response) {
        try {
            const categories = await prisma.category.findMany();
            sendSuccessResponse(res, categories);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
}