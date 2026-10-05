import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";


export default class LecturerGroupHandler {
    static async getClassGroup(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class
            };
    
            const studentGroup = await prisma.temporaryGroup.findMany({
                where: whereCondition
            });
    
            const groupedData = studentGroup.reduce<Record<string, typeof studentGroup[number][]>>((acc, current) => {
                const groupName = current.group;

                const list = acc[groupName] ?? [];
                list.push(current);
                acc[groupName] = list;
    
                return acc;
            }, {});
    
            const sortedGroups = Object.keys(groupedData)
                .sort((a, b) => Number(a) - Number(b))
                .map(name => ({
                    group: Number(name),
                    students: groupedData[name]
                }));
    
            sendSuccessResponse(res, sortedGroups);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

    static async getClassList(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class
            };
    
            const studentGroup = await prisma.temporaryGroup.findMany({
                where: whereCondition
            });
    
            sendSuccessResponse(res, studentGroup);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

    static async removeTemporaryGroup(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                group: z.number()
            });
    
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
                group: params.group
            };
    
            const deletedGroup = await prisma.temporaryGroup.deleteMany({
                where: whereCondition
            });
    
            sendSuccessResponse(res, deletedGroup);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Delete Failed"));
        }
    }
}