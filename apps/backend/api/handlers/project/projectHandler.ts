import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import validateSchema from "api/utils/validator/validateSchema";
import GenericService from "api/services/generic/genericService";
import { prisma } from "api/prisma/client";


export default class ProjectHandler {
    static async insertProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({ 
                lecturer_id: z.string(),
                student_leader_id: z.string(),
                title: z.string(),
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string(),
                github_link: z.string(),
                project_link: z.string(),
                documentation: z.string(),
                video_link: z.string(),
                thumbnail: z.string(),
                description: z.string(),
                status_id: z.number(),
                category_id: z.number(),
                major_id: z.number(),
                gallery: z.array(z.string()),
                group_members: z.array(z.string()).optional(),
                technology_ids: z.array(z.number()),
                group: z.number()
            });
      
            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            const params = validationResult.data;

            const existingProject = await prisma.project.findFirst({
                where: {
                    lecturer_id: params.lecturer_id,
                    projectGroups: {
                        some: {
                            student_id: params.student_leader_id,
                        },
                    },
                    projectDetail: {
                        course_id: params.course_id,
                        semester_id: params.semester_id,
                        class: params.class
                    }
                },
                include: {
                    projectDetail: true,
                    projectGroups: true
                }
            });

            if (existingProject) {
                const projectId = existingProject.id;
    
                await prisma.$transaction([
                    prisma.gallery.deleteMany({ where: { project_id: projectId } }),
                    prisma.projectTechnology.deleteMany({ where: { project_id: projectId } }),
                    prisma.projectGroup.deleteMany({ where: { project_id: projectId } }),
                    prisma.projectDetail.delete({ where: { project_id: projectId } }),
                    prisma.project.delete({ where: { id: projectId } })
                ]);
            }

            const newProject = await prisma.project.create({
                data: {
                  lecturer_id: params.lecturer_id,
                  student_leader_id: params.student_leader_id,
                  is_disable: 0
                },
            });

            const newProjectDetail = await prisma.projectDetail.create({
                data: {
                  project_id: newProject.id,
                  title: params.title,
                  semester_id: params.semester_id,
                  course_id: params.course_id,
                  class: params.class,
                  github_link: params.github_link,
                  project_link: params.project_link,
                  documentation: params.documentation,
                  video_link: params.video_link,
                  thumbnail: params.thumbnail,
                  description: params.description,
                  status_id: params.status_id,
                  category_id: params.category_id,
                  major_id: params.major_id,
                  group: params.group
                },
            });

            const newGallery = params.gallery.map(image => ({
                project_id: newProject.id,
                image
            }));
            await prisma.gallery.createMany({
                data: newGallery
            });

            const newProjectTechnology = params.technology_ids.map(technology_id => ({
                project_id: newProject.id,
                technology_id
            }));
            await prisma.projectTechnology.createMany({
                data: newProjectTechnology
            });
    
            let groupMembers = params.group_members || [];
            if (!groupMembers.includes(params.student_leader_id)) {
                groupMembers.push(params.student_leader_id);
            }

            if (groupMembers.length > 0) {
                const newProjectGroupPromises = groupMembers.map(async (student_id) => {
                    const nameResponse = await GenericService.getName(student_id);
                    const BinusianIdResponse = await GenericService.getBinusianID(student_id);
                    const name = nameResponse.data ?? student_id;
                    const binusianId = BinusianIdResponse.data ?? student_id;

                    return {
                        project_id: newProject.id,
                        student_id,
                        student_name: name,
                        student_binusian_id: binusianId
                    };
                });
            
                const newProjectGroup = await Promise.all(newProjectGroupPromises);
            
                await prisma.projectGroup.createMany({
                    data: newProjectGroup
                });
            }

            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
                group: Number(params.group)
            };
    
            const deletedTemporaryGroup = await prisma.temporaryGroup.deleteMany({
                where: whereCondition
            });
        
            sendSuccessResponse(res, { newProject, newProjectDetail });
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Insert Failed");
        }
    }

    static async getAllProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                search: z.string().optional(),
                categoryFilter: z.string().optional(),
                majorFilter: z.string().optional(),
                technologyFilter: z.string().optional(),
                semester_id: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }

            const params = validationResult.data;
            const whereCondition = {
                is_disable: 0,
                ...(params.search && {
                    OR: [
                        { projectDetail: { title: { contains: params.search } } },
                        { projectGroups: { some: { student_name: { contains: params.search } } } },
                        { projectGroups: { some: { student_id: { contains: params.search } } } },
                        { projectGroups: { some: { student_binusian_id: { contains: params.search } } } }
                    ]
                }),
                ...(params.categoryFilter && {
                    projectDetail: { category_id: Number(params.categoryFilter) }
                }),
                ...(params.majorFilter && {
                    projectDetail: { major_id: Number(params.majorFilter) }
                }),
                ...(params.technologyFilter && {
                    projectTechnologies: { some: { technology_id: Number(params.technologyFilter) } }
                }),
                assessment: { isNot: null }
            };

            const projects = await prisma.project.findMany({
                where: whereCondition,
                include: {
                    projectDetail: true,
                    projectGroups: true,
                    galleries: true,
                    projectTechnologies: true,
                    outstandingProject: true,
                    reviewedProject: true,
                    assessment: true
                },
                orderBy: [
                    {
                        projectDetail: {
                            status_id: 'desc' 
                        }
                    },
                    {
                        outstandingProject: {
                            is_outstanding: 'desc'
                        }
                    },
                    {
                        reviewedProject: {
                            is_recommended: 'desc'
                        }
                    },
                    {
                        assessment: {
                            grade: 'desc'
                        }
                    }
                ]
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

            sendSuccessResponse(res, updatedProjects);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async getDetailProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                id: z.string()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }

            const params = validationResult.data;

            const projects = await prisma.project.findMany({
                where: { id: Number(params.id) },
                include: {
                    projectDetail: true,
                    projectGroups: true,
                    galleries: true,
                    projectTechnologies: true
                }
            });

            const updatedProject = await Promise.all(projects.map(async (project) => {
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

            sendSuccessResponse(res, updatedProject);
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}