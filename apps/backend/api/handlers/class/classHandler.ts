import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import ClassService from "../../services/class/classService.js";

export default class ClassHandler {
    static async listLecturerClasses(req: Request, res: Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                lecturer_id: z.string(),
                course_id: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassService.listLecturerClasses(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listLecturerCourses(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ semester_id: z.string(), lecturer_id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassService.listLecturerCourses(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listStudentClasses(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ semester_id: z.string(), student_id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassService.listStudentClasses(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async listClassStudents(req: Request, res: Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                class: z.string(),
                course_id: z.string()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassService.listClassStudents(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }
}
