import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class StudentProjectHandler {
    static async getStudentClassProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                student_id: z.string()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }

            const params = validationResult.data;

            const classExists = await prisma.class.findFirst({
                where: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class
                }
            });
    
            const includeAssessment = !!classExists;
            
            const projects = await prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        course_id: params.course_id,       
                        class: params.class,               
                    },
                    projectGroups: {
                        some: {
                            student_id: params.student_id
                        }
                    }
                },
                include: {
                    projectDetail: true,
                    projectGroups: true,
                    galleries: true,
                    projectTechnologies: true,
                    assessment: includeAssessment
                }
            });

            const updatedProjects = await Promise.all(projects.map(async (project) => {
                const updatedProjectGroups = project.projectGroups.map(group => {
                    const { id, project_id, ...otherAttributes } = group;
                    return otherAttributes;
                });
    
                const updatedGalleries = project.galleries.map(gallery => {
                    const { id, project_id, ...otherAttributes } = gallery;
                    return otherAttributes;
                });

                const updatedProjectTechnologies = await Promise.all(
                    project.projectTechnologies.map(async (technology) => {
                        const technologyDetails = await prisma.technology.findUnique({
                            where: { id: technology.technology_id }
                        });
                        const { id, project_id, ...otherAttributes } = technology;
                        return {
                            ...otherAttributes,
                            technology_name: technologyDetails.name
                        };
                    })
                );
    
                return {
                    ...project,
                    projectGroups: updatedProjectGroups,
                    galleries: updatedGalleries,
                    projectTechnologies: updatedProjectTechnologies
                };
            }));
            
            const classTransactions = await prisma.classTransaction.findFirst({
                where: {
                    semester_id: params.semester_id,
                    course_code: params.course_id,
                    class: params.class
                }
            });

            sendSuccessResponse(res, {updatedProjects, classTransactions});
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async getAllStudentProfileProject(req: Request, res: Response, next: NextFunction) {
        try {
            const schema = z.object({
                student_id: z.string()
            });
    
            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }
    
            const params = validationResult.data;
    
            const projects = await prisma.project.findMany({
                where: {
                    projectGroups: {
                        some: {
                            student_id: params.student_id
                        }
                    }
                },
                include: {
                    projectDetail: true,
                    projectGroups: true,
                    galleries: true,
                    projectTechnologies: true,
                    assessment: true 
                },
                orderBy: {
                    created_at: "desc"
                }
            });
    
            const updatedProjects = await Promise.all(
                projects.map(async (project) => {
                    const updatedProjectGroups = project.projectGroups.map(group => {
                        const { id, project_id, ...otherAttributes } = group;
                        return otherAttributes;
                    });
    
                    const updatedGalleries = project.galleries.map(gallery => {
                        const { id, project_id, ...otherAttributes } = gallery;
                        return otherAttributes;
                    });
    
                    const updatedProjectTechnologies = await Promise.all(
                        project.projectTechnologies.map(async (technology) => {
                            const technologyDetails = await prisma.technology.findUnique({
                                where: { id: technology.technology_id }
                            });
                            const { id, project_id, ...otherAttributes } = technology;
                            return {
                                ...otherAttributes,
                                technology_name: technologyDetails.name
                            };
                        })
                    );
    
                    return {
                        ...project,
                        projectGroups: updatedProjectGroups,
                        galleries: updatedGalleries,
                        projectTechnologies: updatedProjectTechnologies
                    };
                })
            );
    
            sendSuccessResponse(res, updatedProjects);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
    
}