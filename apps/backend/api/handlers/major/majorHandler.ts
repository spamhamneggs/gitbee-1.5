import type { Request, Response } from "express";
import { sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import MajorService from "../../services/major/majorService.js";

export default class MajorHandler {
    static async listMajors(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await MajorService.listMajors());
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }
}
