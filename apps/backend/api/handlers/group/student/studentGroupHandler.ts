import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";
import GenericService from "../../../services/generic/genericService.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";


export default class StudentGroupHandler {
    static async insertTemporaryGroup(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                student_ids: z.array(z.string()).or(z.string()),
            });
    
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }
    
            const params = validationResult.data;
            const studentIds = Array.isArray(params.student_ids) ? params.student_ids : [params.student_ids];

            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class
            };
            // Resolve external data before taking database locks, including retries.
            const members = await Promise.all(studentIds.map(async (student_id) => {
                const [name, binusianId] = await Promise.all([
                    GenericService.getName(student_id),
                    GenericService.getBinusianID(student_id)
                ]);
                return {
                    student_id,
                    student_name: name.data ?? student_id,
                    student_binusian_id: binusianId.data ?? student_id
                };
            }));

            for (let attempt = 0; ; attempt++) {
                try {
                    const insertedGroups = await prisma.$transaction(async (tx) => {
                        const [existingMember, existingProject] = await Promise.all([
                            tx.temporaryGroup.findFirst({
                                where: { ...whereCondition, student_id: { in: studentIds } },
                                select: { id: true }
                            }),
                            tx.project.findFirst({
                                where: {
                                    projectDetail: whereCondition,
                                    projectGroups: { some: { student_id: { in: studentIds } } }
                                },
                                select: { id: true }
                            })
                        ]);
                        if (existingMember || existingProject) return null;

                        const [temporaryGroups, projectGroups] = await Promise.all([
                            tx.temporaryGroup.findMany({ where: whereCondition, select: { group: true } }),
                            tx.projectDetail.findMany({ where: whereCondition, select: { group: true } })
                        ]);
                        const usedNumbers = new Set([...temporaryGroups, ...projectGroups].map((row) => row.group));
                        let group = 1;
                        while (usedNumbers.has(group)) group++;

                        return Promise.all(members.map((member) => tx.temporaryGroup.create({
                            data: { ...whereCondition, group, ...member }
                        })));
                    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

                    if (!insertedGroups) {
                        return sendErrorResponse(res, "One Of The Group Members Has Already Created A Group");
                    }
                    return sendSuccessResponse(res, insertedGroups);
                } catch (error) {
                    // Serializable allocations can deadlock; retry from a fresh snapshot.
                    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
                        if (attempt < 4) continue;
                        return sendErrorResponse(res, "Another group is being created. Please try again.", 409);
                    }
                    throw error;
                }
            }
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }

    static async getCurrentStudentGroup(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                student_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
                student_id: params.student_id
            };
    
            const currentStudentGroup = await prisma.temporaryGroup.findFirst({
                where: whereCondition
            });

            if (!currentStudentGroup) {
                return sendSuccessResponse(res, []);
            }
    
            const groupMembers = await prisma.temporaryGroup.findMany({
                where: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class,
                    group: currentStudentGroup.group
                }
            });
    
            sendSuccessResponse(res, groupMembers);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
}
