import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class MajorHandler {
    static async getAllMajor(req : Request, res : Response) {
        try {
            const majors = await prisma.major.findMany();
            sendSuccessResponse(res, majors);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

}