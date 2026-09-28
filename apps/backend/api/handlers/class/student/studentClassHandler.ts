import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class StudentClassHandler {
    static async studentClassTransaction(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                student_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
    
            const studentListTransactions = await prisma.studentListTransaction.findMany({
                where: {
                    semester_id: params.semester_id,
                    student_id: params.student_id
                }
            });

            const classTransactions = await prisma.classTransaction.findMany({
                where: {
                    semester_id: params.semester_id
                }
            });

            const updatedStudentTransaction = studentListTransactions.map((studentData) => {
                const classData = classTransactions.find(
                    (classTransaction) =>
                        classTransaction.class === studentData.class &&
                        classTransaction.semester_id === studentData.semester_id &&
                        classTransaction.course_code === studentData.course_code
                );
    
                return {
                    id: studentData.id,
                    semester_id: studentData.semester_id,
                    student_id: studentData.student_id,
                    student_name: studentData.student_name,
                    class: studentData.class,
                    lecturer_code: classData?.lecturer_code ?? null,
                    lecturer_name: classData?.lecturer_name ?? null,
                    course_code: classData?.course_code ?? null,
                    course_name: classData?.course_name ?? null,
                    location: classData?.location ?? null
                };
            });
    
            sendSuccessResponse(res, updatedStudentTransaction);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async studentListInClass(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                class: z.string(),
                course_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;

            const studentLists = await prisma.studentListTransaction.findMany({
                where: {
                    semester_id: params.semester_id,
                    class: params.class,
                    course_code: params.course_id
                }
            });

            const groupedStudents = await prisma.temporaryGroup.findMany({
                where: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class,
                },
                select: { student_id: true }
            });

            const projectsWithDetailsAndGroups = await prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        course_id: params.course_id,
                        class: params.class,
                    },
                },
                include: {
                    projectGroups: {
                        select: { student_id: true },
                    },
                    projectDetail: true, 
                },
            });
    
            const groupedStudentIds = new Set(groupedStudents.map((g) => g.student_id));
            const projectStudentIds = new Set(
                projectsWithDetailsAndGroups.flatMap((project) =>
                    project.projectGroups.map((group) => group.student_id)
                )
            );

            const studentListsWithDisableFlag = studentLists.map((student) => ({
                ...student,
                is_disable:
                    groupedStudentIds.has(student.student_id) || projectStudentIds.has(student.student_id)
                        ? 1
                        : 0,
            }));

            sendSuccessResponse(res, studentListsWithDisableFlag);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}