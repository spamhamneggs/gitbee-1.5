import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import GroupService from "../../services/group/groupService.js";

const classQuery = {
    semester_id: z.string(),
    course_id: z.string(),
    class: z.string()
};

export default class GroupHandler {
    static async createGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const schema = z.object({
                ...classQuery,
                student_ids: z.array(z.string()).or(z.string()),
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            const { student_ids, ...classRef } = validationResult.data;
            const studentIds = Array.isArray(student_ids) ? student_ids : [student_ids];
            sendSuccessResponse(res, await GroupService.createGroup(classRef, studentIds));
        } catch (error) {
            next(error);
        }
    }

    static async getStudentGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const validationResult = validateSchema(z.object({ ...classQuery, student_id: z.string() }), req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            const { student_id, ...classRef } = validationResult.data;
            sendSuccessResponse(res, await GroupService.getStudentGroup(classRef, student_id));
        } catch (error) {
            next(error);
        }
    }

    static async deleteGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const validationResult = validateSchema(z.object({ ...classQuery, group: z.number() }), req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            const { group, ...classRef } = validationResult.data;
            sendSuccessResponse(res, await GroupService.deleteGroup(classRef, group));
        } catch (error) {
            next(error);
        }
    }
}
