import { prisma } from "../../prisma/client.js";

type FormattableProject = {
    projectGroups: { id: number; project_id: number }[];
    galleries: { id: number; project_id: number }[];
    projectTechnologies: { id: number; project_id: number; technology_id: number }[];
};

export const formatProjects = async <T extends FormattableProject>(projects: T[]) => {
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
