import { z } from "zod";
import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import validateSchema from "../../utils/validator/validateSchema.js";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../../prisma/client.js";


export default class ProjectHandler {
    static async insertProject(req : Request, res : Response) {
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

            const groupMembers = params.group_members || [];
            if (!groupMembers.includes(params.student_leader_id)) {
                groupMembers.push(params.student_leader_id);
            }

            const whereCondition = {
                semester_id: params.semester_id,
                course_id: params.course_id,
                class: params.class,
                group: Number(params.group)
            };

            // Local lookups replace the two Atlantis HTTP calls per group member:
            // the user table wins, then the group's temporary roster (members who
            // have not logged in yet), then the names on the project being
            // replaced, then the NIM.
            const [memberUsers, roster] = await Promise.all([
                prisma.user.findMany({
                    where: { student_id: { in: groupMembers } },
                    select: { student_id: true, name: true, binusian_id: true }
                }),
                prisma.temporaryGroup.findMany({ where: whereCondition })
            ]);
            const memberByIdentifier = new Map(
                memberUsers.map((member) => [member.student_id, member])
            );
            const rosterById = new Map(
                roster.map((member) => [member.student_id, member])
            );

            const { newProject, newProjectDetail } = await prisma.$transaction(async (tx) => {
                // Match the same columns as the project_detail unique key
                // (semester/course/class/group). If the lookup filtered on other
                // columns (lecturer, group member), a resubmit could miss the old
                // project, hit the unique key on insert, and 409 on every try.
                const existingProject = await tx.project.findFirst({
                    where: { projectDetail: whereCondition },
                    include: {
                        projectDetail: true,
                        projectGroups: true
                    }
                });

                if (existingProject) {
                    const projectId = existingProject.id;

                    // deleteMany, not delete: a concurrent resubmit may have already
                    // removed these rows, and that must not throw here. Its own
                    // project_detail insert then hits the group unique key and the
                    // whole transaction rolls back (409).
                    await tx.gallery.deleteMany({ where: { project_id: projectId } });
                    await tx.projectTechnology.deleteMany({ where: { project_id: projectId } });
                    await tx.projectGroup.deleteMany({ where: { project_id: projectId } });
                    await tx.projectDetail.deleteMany({ where: { project_id: projectId } });
                    await tx.project.deleteMany({ where: { id: projectId } });
                }

                const project = await tx.project.create({
                    data: {
                      lecturer_id: params.lecturer_id,
                      student_leader_id: params.student_leader_id,
                      is_disable: 0
                    },
                });

                const projectDetail = await tx.projectDetail.create({
                    data: {
                      project_id: project.id,
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
                    project_id: project.id,
                    image
                }));
                await tx.gallery.createMany({
                    data: newGallery
                });

                const newProjectTechnology = params.technology_ids.map(technology_id => ({
                    project_id: project.id,
                    technology_id
                }));
                await tx.projectTechnology.createMany({
                    data: newProjectTechnology
                });

                if (groupMembers.length > 0) {
                    const newProjectGroup = groupMembers.map((student_id) => {
                        const member = memberByIdentifier.get(student_id);
                        const rosterMember = rosterById.get(student_id);
                        // The first submit cleared temporary_group, so a resubmit
                        // falls back to the names saved on the project it replaces.
                        const previousMember = existingProject?.projectGroups.find(
                            (row) => row.student_id === student_id
                        );

                        return {
                            project_id: project.id,
                            student_id,
                            student_name: member?.name ?? rosterMember?.student_name ?? previousMember?.student_name ?? student_id,
                            student_binusian_id: member?.binusian_id ?? rosterMember?.student_binusian_id ?? previousMember?.student_binusian_id ?? student_id
                        };
                    });

                    await tx.projectGroup.createMany({
                        data: newProjectGroup
                    });
                }

                await tx.temporaryGroup.deleteMany({
                    where: whereCondition
                });

                return { newProject: project, newProjectDetail: projectDetail };
            });

            sendSuccessResponse(res, { newProject, newProjectDetail });
        } catch (error) {
            // Only the project_detail group key means "this group already has a
            // project". Other P2002s (e.g. a duplicate technology_id) are bad
            // input and fall through to the generic 400.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                error.meta?.modelName === "ProjectDetail"
            ) {
                return sendErrorResponse(res, "A project already exists for this group.", 409);
            }
            sendErrorResponse(res, getErrorMessage(error, "Insert Failed"));
        }
    }

    static async getAllProject(req : Request, res : Response) {
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
                            technology_name: technologyDetails?.name
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
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }

    static async getDetailProject(req : Request, res : Response) {
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
                            technology_name: technologyDetails?.name
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
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
}