import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class LecturerProjectHandler {
    static async getAllLecturerClassProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                semester_id: z.string(),
                course_id: z.string(),
                class: z.string()
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

            const totalStudents = await prisma.studentListTransaction.count({
                where: {
                    semester_id: params.semester_id,
                    course_code: params.course_id,
                    class: params.class
                }
            });

            const studentGroup = await prisma.temporaryGroup.findMany({
                where: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class
                }
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

            let studentsInProjectGroups = 0;
            updatedProjects.forEach(project => {
                studentsInProjectGroups += project.projectGroups.length;
            });
    
            let studentsInSortedGroups = 0;
            sortedGroups.forEach(group => {
                studentsInSortedGroups += group.students.length;
            });
            const countStudentSubmitted = studentsInProjectGroups + studentsInSortedGroups;

            sendSuccessResponse(res, {updatedProjects, sortedGroups, totalStudents, countStudentSubmitted});
        } catch (error) {
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }

    static async getAllLecturerGoodProject(req : Request, res : Response, next : NextFunction) {
        try {
            const schema = z.object({
                semester_id: z.string().optional(),
                lecturer_id: z.string(),
                search: z.string().optional()
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message ? validationResult.message : "Fetch Failed");
            }

            const params = validationResult.data;
            const whereCondition = {
                ...(params.search && {
                    OR: [
                        { projectDetail: { title: { contains: params.search } } },
                        { projectDetail: { course_id: { contains: params.search } } },
                        { projectDetail: { class: { contains: params.search } } } 
                    ]
                }),
                ...(params.semester_id && {
                    projectDetail: { semester_id: params.semester_id }
                }),
                lecturer_id: params.lecturer_id,
                assessment: { isNot: null }
            };
            
            const projects = await prisma.project.findMany({
                where: whereCondition,
                include: {
                    projectDetail: true,
                    projectGroups: true,
                    galleries: true,
                    projectTechnologies: true,
                    assessment: true
                }
            });

            const filteredProjects = projects.filter((project) => {
                return project.assessment?.grade !== undefined && project.assessment.grade >= 4;
            });

            const updatedProjects = await Promise.all(filteredProjects.map(async (project) => {
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
}