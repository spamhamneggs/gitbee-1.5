import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class StatusHandler {
    static async getAllStatus(req : Request, res : Response) {
        try {
            const statuses = await prisma.status.findMany();
            sendSuccessResponse(res, statuses);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
}