import { prisma } from "api/prisma/client";


export const formatProjects = async (projects: any[]) => {
    return Promise.all(projects.map(async (project) => {
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
};
