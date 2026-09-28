import type { Request, Response } from "express";
import { getErrorMessage, sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";


export default class ReviewedProjectHandler { 
    static async getAllReviewedProject(req : Request, res : Response) {
        try {
            const reviewedProjects = await prisma.reviewedProject.findMany({
                where: {
                    is_recommended: 1
                },
                include: {
                    project: {
                        include: {
                            projectDetail: true,
                            projectGroups: true,
                            galleries: true,
                            projectTechnologies: true
                        }
                    }
                }
            });

            const updatedReviewedProjects = await Promise.all(reviewedProjects.map(async (reviewedProject) => {
                const { project_id, ...updatedReviewedProjects } = reviewedProject;

                const project = reviewedProject.project;
                const { created_at, ...updatedProject } = project;
    
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
                            technology_name: technologyDetails ? technologyDetails.name : null
                        };
                    })
                );
    
                return {
                    ...updatedReviewedProjects,
                    project: {
                        ...updatedProject,
                        projectGroups: updatedProjectGroups,
                        galleries: updatedGalleries,
                        projectTechnologies: updatedProjectTechnologies
                    }
                };
            }));
    
            sendSuccessResponse(res, updatedReviewedProjects);
        } catch (error) {
            sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
        }
    }
}