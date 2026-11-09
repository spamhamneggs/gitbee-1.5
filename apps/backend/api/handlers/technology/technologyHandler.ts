import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import { sendErrorResponse, sendServiceError, sendSuccessResponse } from "../../utils/response/response.js";
import TechnologyService from "../../services/technology/technologyService.js";

export default class TechnologyHandler {
    static async listTechnologies(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await TechnologyService.listTechnologies());
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async createTechnology(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ name: z.string() }), req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await TechnologyService.createTechnology(validationResult.data.name));
        } catch (error) {
            sendServiceError(res, error, "Insert Failed");
        }
    }

    static async updateTechnology(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(z.object({ id: z.string(), name: z.string() }), req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const { id, name } = validationResult.data;
            sendSuccessResponse(res, await TechnologyService.updateTechnology(Number(id), name));
        } catch (error) {
            sendServiceError(res, error, "Update Failed");
        }
    }
}
