import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import OutstandingProjectService from "../../services/outstandingProject/outstandingProjectService.js";

export default class OutstandingProjectHandler {
    static async recordDecision(req: Request, res: Response) {
        try {
            const schema = z.object({
                project_id: z.number(),
                is_outstanding: z.number(),
                feedback: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await OutstandingProjectService.recordDecision(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }
}
