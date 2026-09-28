import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class LecturerGroupHandler {
    static async getClassGroup(req : Request, res : Response, next : NextFunction) {
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
    
            const groupedData = studentGroup.reduce((acc: any, current: any) => {
                const groupName = current.group;

                if (!acc[groupName]) {
                    acc[groupName] = [];
                }
    
                acc[groupName].push(current);
    
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
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async getClassList(req : Request, res : Response, next : NextFunction) {
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
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async removeTemporaryGroup(req : Request, res : Response, next : NextFunction) {
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
            sendErrorResponse(res, error.message ? error.message : "Delete Failed");
        }
    }
}