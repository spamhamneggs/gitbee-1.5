import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class LecturerClassHandler {
    static async checkFinalize(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                lecturer_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
    
            const classExists = await prisma.class.findFirst({
                where: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class,
                    lecturer_id: params.lecturer_id
                }
            });

            const isExists = !!classExists;
    
            sendSuccessResponse(res, isExists);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }

    static async lecturerClassTransaction(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                lecturer_id: z.string(),
                course_id: z.string().optional()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;

            const classTransactions = await prisma.classTransaction.findMany({
                where: {
                    semester_id: params.semester_id,
                    lecturer_code: params.lecturer_id,
                    ...(params.course_id ? { course_code: params.course_id } : {})
                }
            });

            const studentCounts = await Promise.all(classTransactions.map(async (classTransaction) => {
                const count = await prisma.studentListTransaction.count({
                    where: {
                        semester_id: params.semester_id,
                        class: classTransaction.class,
                        course_code: classTransaction.course_code
                    }
                });
                return { classId: classTransaction.id, total_students: count };
            }));
    
            const formattedResponse = classTransactions.map(classTransaction => {
                const studentData = studentCounts.find(sc => sc.classId === classTransaction.id);
                return {
                    ...classTransaction,
                    total_students: studentData ? studentData.total_students : 0
                };
            });
    
            sendSuccessResponse(res, formattedResponse);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async lecturerListCourse(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                lecturer_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;

            const classTransactions = await prisma.classTransaction.groupBy({
                by: ['course_code', 'course_name'],
                where: {
                    semester_id: params.semester_id,
                    lecturer_code: params.lecturer_id
                }
            });

            const listCourses = classTransactions.map((transaction) => ({
                course_code: transaction.course_code,
                course_name: transaction.course_name
            }));
    
            sendSuccessResponse(res, listCourses);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}