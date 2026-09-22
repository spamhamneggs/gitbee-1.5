import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";
import { formatProjects } from "api/utils/formatter/formatterProject";


export default class HopProjectHandler {
    static async getHoPDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const schema = z.object({
                major_id: z.string(),
                semester_id: z.string(),
                is_outstanding: z.string().optional(),
                search: z.string().optional()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Validation Failed");
            }
    
            const params = validationResult.data;
            const searchCondition = params.search
            ? {
                  OR: [
                      { projectDetail: { title: { contains: params.search }}}, 
                      {
                          projectGroups: {
                              some: {
                                  OR: [
                                      { student_id: { contains: params.search } }, 
                                      { student_name: { contains: params.search } } 
                                  ]
                              }
                          }
                      }
                  ]
              }
            : {};            
            const isOutstandingCondition = params.is_outstanding ? { is_outstanding: Number(params.is_outstanding) } : {};

            const [reviewedProjects, notReviewedProjects] = await Promise.all([
                prisma.project.findMany({
                    where: {
                        projectDetail: {
                            semester_id: params.semester_id,
                            major_id: Number(params.major_id),
                            status_id: 4
                        },
                        ...(isOutstandingCondition ? { outstandingProject: isOutstandingCondition } : {}),
                        ...searchCondition
                    },
                    include: {
                        projectDetail: true,
                        projectGroups: true,
                        galleries: true,
                        projectTechnologies: true,
                        assessment: true,
                        outstandingProject: true
                    },
                    orderBy: {
                        assessment: {
                            grade: 'desc'
                        }
                    }
                }),
                prisma.project.findMany({
                    where: {
                        projectDetail: {
                            semester_id: params.semester_id,
                            major_id: Number(params.major_id),
                            status_id: 3
                        },
                        reviewedProject: { is_recommended: 1 },
                        ...searchCondition
                    },
                    include: {
                        projectDetail: true,
                        projectGroups: true,
                        galleries: true,
                        projectTechnologies: true,
                        assessment: true
                    },
                    orderBy: {
                        assessment: {
                            grade: 'desc'
                        }
                    }
                })
            ]);
    
            const formattedReviewedProjects = await formatProjects(reviewedProjects);
            const formattedNotReviewedProjects = await formatProjects(notReviewedProjects);

            const finalReviewedProjects = await Promise.all(
                formattedReviewedProjects.map(async (project) => {
                    const lecturer = await prisma.user.findUnique({
                        where: { lecturer_code: project.lecturer_id }
                    });

                    const major = await prisma.major.findUnique({
                        where: { id: project.projectDetail.major_id }
                    });

                    const category = await prisma.category.findUnique({
                        where: { id: project.projectDetail.category_id }
                    });

                    const course = await prisma.classTransaction.findFirst({
                        where: { 
                            course_code: project.projectDetail.course_id 
                        }
                    });
    
                    return {
                        ...project,
                        lecturer_name: lecturer ? lecturer.name : null,
                        projectDetail: {
                            ...project.projectDetail,
                            major_name: major ? major.name : null,
                            category_name: category ? category.name : null,
                            course_name: course ? course.course_name : null
                        },
                    };
                })
            );
    
            const finalNotReviewedProjects = await Promise.all(
                formattedNotReviewedProjects.map(async (project) => {
                    const lecturer = await prisma.user.findUnique({
                        where: { lecturer_code: project.lecturer_id }
                    });
    
                    const major = await prisma.major.findUnique({
                        where: { id: project.projectDetail.major_id }
                    });

                    const category = await prisma.category.findUnique({
                        where: { id: project.projectDetail.category_id }
                    });
    
                    const course = await prisma.classTransaction.findFirst({
                        where: { 
                            course_code: project.projectDetail.course_id 
                        }
                    });
    
                    return {
                        ...project,
                        lecturer_name: lecturer ? lecturer.name : null,
                        projectDetail: {
                            ...project.projectDetail,
                            major_name: major ? major.name : null,
                            category_name: category ? category.name : null,
                            course_name: course ? course.course_name : null
                        },
                    };
                })
            );
    
            const response = {
                "count reviewed": finalReviewedProjects.length,
                "count not reviewed": finalNotReviewedProjects.length,
                "reviewed": finalReviewedProjects,
                "not reviewed": finalNotReviewedProjects
            };
    
            sendSuccessResponse(res, response);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}