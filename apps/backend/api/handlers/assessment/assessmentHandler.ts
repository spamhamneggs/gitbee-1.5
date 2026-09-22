import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class AssessmentHandler {
    static async insertAssessment(req : Request, res : Response) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                lecturer_id: z.string(),
                assessments: z.array(z.object({
                    project_id: z.string(),
                    grade: z.number(), 
                    reason: z.string().optional() 
                }))
            });
    
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Invalid Parameters");
            }
    
            const params = validationResult.data;
    
            // const insertedAssessments = await prisma.$transaction(
            //     params.assessments.map((assessment) => prisma.assessment.create({
            //         data: {
            //             project_id: Number(assessment.project_id),
            //             grade: assessment.grade,
            //             reason: assessment.reason ?? "",
            //             created_at: new Date()
            //         }
            //     }))
            // );

            // const finalizeClass = await prisma.class.create({
            //     data: {
            //         semester_id: params.semester_id, 
            //         course_id: params.course_id, 
            //         class: params.class, 
            //         lecturer_id: params.lecturer_id,
            //         finalized_at: new Date()
            //     }
            // });

            const insertedAssessments = await prisma.$transaction([
                ...params.assessments.map((assessment) =>
                    prisma.assessment.create({
                        data: {
                            project_id: Number(assessment.project_id),
                            grade: assessment.grade,
                            reason: assessment.reason ?? "",
                            created_at: new Date()
                        }
                    })
                ),
    
                ...params.assessments.map((assessment) =>
                    prisma.projectDetail.update({
                        where: { project_id: Number(assessment.project_id) },
                        data: { status_id: 2 }
                    })
                ),
    
                prisma.class.create({
                    data: {
                        semester_id: params.semester_id,
                        course_id: params.course_id,
                        class: params.class,
                        lecturer_id: params.lecturer_id,
                        finalized_at: new Date()
                    }
                })
            ]);
    
            sendSuccessResponse(res, insertedAssessments);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }
}