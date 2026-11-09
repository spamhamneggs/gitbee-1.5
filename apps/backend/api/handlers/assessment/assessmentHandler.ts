import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import AssessmentService from "../../services/assessment/assessmentService.js";

export default class AssessmentHandler {
    static async gradeClass(req: Request, res: Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                lecturer_id: z.string(),
                assessments: z.array(z.object({
                    project_id: z.string(),
                    grade: z.number(),
                    reason: z.string().optional()
                }))
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await AssessmentService.gradeClass(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }
}
