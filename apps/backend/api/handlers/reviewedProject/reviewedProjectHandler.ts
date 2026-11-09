import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import ReviewedProjectService from "../../services/reviewedProject/reviewedProjectService.js";

export default class ReviewedProjectHandler {
    static async recordReview(req: Request, res: Response) {
        try {
            const schema = z.object({
                project_id: z.number(),
                is_recommended: z.number(),
                feedback: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await ReviewedProjectService.recordReview(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }
}
