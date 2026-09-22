import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";
import { formatProjects } from "api/utils/formatter/formatterProject";


export default class AdminProjectHandler { 
    static async getAdminDashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const schema = z.object({
                search: z.string().optional(),
                majorFilter: z.string().optional(), 
                categoryFilter: z.string().optional(), 
                semester_id: z.string().optional()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Validation Failed");
            }
    
            const params = validationResult.data;
            const whereConditions = (statusId: number) => ({
                projectDetail: {
                    status_id: statusId,
                    ...(params.majorFilter && { major_id: Number(params.majorFilter) }),
                    ...(params.categoryFilter && { category_id: Number(params.categoryFilter) }),
                    ...(params.semester_id && { semester_id: params.semester_id })
                },
                ...(params.search && {
                    OR: [
                        { projectDetail: { title: { contains: params.search } } },
                        { projectGroups: { some: { student_name: { contains: params.search } } } },
                        { projectGroups: { some: { student_id: { contains: params.search } } } },
                        { projectGroups: { some: { student_binusian_id: { contains: params.search } } } }
                    ]
                }),
            });
    
            const [submittedProjects, gradedProjects, reviewedProjects, outstandingProjects] = await Promise.all([
                prisma.project.findMany({
                    where: whereConditions(1),
                    include: {
                        projectDetail: true,
                        projectGroups: true,
                        galleries: true,
                        projectTechnologies: true,
                    }
                }),
                prisma.project.findMany({
                    where: whereConditions(2),
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
                }),
                prisma.project.findMany({
                    where: whereConditions(3),
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
                }),
                prisma.project.findMany({
                    where: whereConditions(4),
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
    
            const formattedSubmittedProjects = await formatProjects(submittedProjects);
            const formattedGradedProjects = await formatProjects(gradedProjects);
            const formattedReviewedProjects = await formatProjects(reviewedProjects);
            const formattedOutstandingProjects = await formatProjects(outstandingProjects);

            const response = {
                "count submitted": formattedSubmittedProjects.length,
                "count graded": formattedGradedProjects.length,
                "count reviewed": formattedReviewedProjects.length,
                "count outstanding": formattedOutstandingProjects.length,
                "submitted": formattedSubmittedProjects,
                "graded": formattedGradedProjects,
                "reviewed": formattedReviewedProjects,
                "outstanding": formattedOutstandingProjects
            };
    
            sendSuccessResponse(res, response);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
    
    static async updateDisableToggle(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                project_id: z.string()
            });

            const validationResult = validateSchema(schema , req.query);
            if (validationResult.error) {
              return sendErrorResponse(res, validationResult.message ? validationResult.message : "Insert Failed");
            }

            const params = validationResult.data;
            const project = await prisma.project.findUnique({
                where: { id: Number(params.project_id) },
                select: { is_disable: true }
            });
    
            if (!project) {
                return sendErrorResponse(res, "Project not found");
            }
    
            const newIsDisable = project.is_disable === 0 ? 1 : 0;
    
            await prisma.project.update({
                where: { 
                    id: Number(params.project_id) 
                },
                data: { 
                    is_disable: newIsDisable 
                }
            });

            return sendSuccessResponse(res, "Update completed successfully!");
        } catch (error) {
            return sendErrorResponse(res, error.message);
        }
    }
}