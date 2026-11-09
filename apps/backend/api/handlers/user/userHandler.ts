import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import StudentService from "../../services/student/studentService.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class UserHandler {
    static async getName(req: Request, res: Response) {
        try {
            const schema = z.object({ nim: z.string().trim().min(1) });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details, 400);
            }

            const name = await StudentService.findStudentName(validationResult.data.nim);
            if (!name) {
                return sendErrorResponse(res, "Student not found", 404);
            }
            sendSuccessResponse(res, name);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

    static async getAllRole(req: Request, res: Response) {
        try {
            const roles = await prisma.role.findMany();
            sendSuccessResponse(res, roles);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }    
}