import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse, sendSuccessResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";


export default class ReviewedProjectHandler { 
    static async getAllReviewedProject(req : Request, res : Response, next : NextFunction) {
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
            sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
        }
    }
}