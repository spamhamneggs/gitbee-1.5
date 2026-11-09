import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class TechnologyHandler {
    static async getAllTechnology(req : Request, res : Response) {
        try {
            const technologies = await prisma.technology.findMany();
            sendSuccessResponse(res, technologies);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
    
}