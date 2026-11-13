import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import CategoryService from "../../services/category/categoryService.js";

export default class CategoryHandler {
    static async listCategories(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await CategoryService.listCategories());
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async createCategory(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ name: z.string() }), req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await CategoryService.createCategory(validationResult.data.name));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ id: z.string(), name: z.string() }), req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const { id, name } = validationResult.data;
            sendSuccessResponse(res, await CategoryService.updateCategory(Number(id), name));
        } catch (error) {
            sendServiceError(res, error, "Update Failed");
        }
    }
}
