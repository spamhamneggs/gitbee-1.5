import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { ServiceError } from "../../utils/response/response.js";
import { groupByNumber } from "../group/groupService.js";

type FormattableProject = {
    projectGroups: { id: number; project_id: number }[];
    galleries: { id: number; project_id: number }[];
    projectTechnologies: { id: number; project_id: number; technology_id: number }[];
};

/** Drops the row ids from a project's child rows and adds each technology's name. */
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

const projectWithChildren = {
    projectDetail: true,
    projectGroups: true,
    galleries: true,
    projectTechnologies: true
} as const;

export interface SubmitProjectInput {
    lecturer_id: string;
    student_leader_id: string;
    title: string;
    semester_id: string;
    course_id: string;
    class: string;
    github_link: string;
    project_link: string;
    documentation: string;
    video_link: string;
    thumbnail: string;
    description: string;
    status_id: number;
    category_id: number;
    major_id: number;
    gallery: string[];
    group_members?: string[] | undefined;
    technology_ids: number[];
    group: number;
}

export interface ExploreFilters {
    search?: string | undefined;
    categoryFilter?: string | undefined;
    majorFilter?: string | undefined;
    technologyFilter?: string | undefined;
}

export interface ClassFilter {
    semester_id: string;
    course_id: string;
    class: string;
}

export default class ProjectService {
    /**
     * Creates the group's project, or replaces the one it already has, in one
     * transaction. Only the signed-in student can lead, and only a member of
     * the saved project (or, on a first submit, of the reserved group) can submit.
     */
    static async submitProject(params: SubmitProjectInput, requesterNim: unknown) {
        if (typeof requesterNim !== "string" || !requesterNim || requesterNim !== params.student_leader_id) {
            throw new ServiceError("The project leader must match the signed-in student.", 403);
        }

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
        const memberUsers = await prisma.user.findMany({
            where: { student_id: { in: groupMembers } },
            select: { student_id: true, name: true, binusian_id: true }
        });
        const memberByIdentifier = new Map(
            memberUsers.map((member) => [member.student_id, member])
        );

        try {
            const submitted = await prisma.$transaction(async (tx) => {
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
                const roster = await tx.temporaryGroup.findMany({ where: whereCondition });
                const allowedMembers = existingProject?.projectGroups ?? roster;
                if (!allowedMembers.some((member) => member.student_id === requesterNim)) {
                    return null;
                }
                const rosterById = new Map(
                    roster.map((member) => [member.student_id, member])
                );

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

                await tx.gallery.createMany({
                    data: params.gallery.map(image => ({
                        project_id: project.id,
                        image
                    }))
                });

                await tx.projectTechnology.createMany({
                    data: params.technology_ids.map(technology_id => ({
                        project_id: project.id,
                        technology_id
                    }))
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
                    where: { ...whereCondition, student_id: { in: groupMembers } }
                });

                return { newProject: project, newProjectDetail: projectDetail };
            });

            if (!submitted) {
                throw new ServiceError("You are not a member of this group.", 409);
            }
            return submitted;
        } catch (error) {
            // Only the project_detail group key means "this group already has a
            // project". Other P2002s (e.g. a duplicate technology_id) are bad
            // input and fall through to the generic 400.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                error.meta?.modelName === "ProjectDetail"
            ) {
                throw new ServiceError("A project already exists for this group.", 409);
            }
            throw error;
        }
    }

    /** Graded, enabled projects for the public explore page, best first. */
    static async listExploreProjects(params: ExploreFilters) {
        const projects = await prisma.project.findMany({
            where: {
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
            },
            include: {
                ...projectWithChildren,
                outstandingProject: true,
                reviewedProject: true,
                assessment: true
            },
            orderBy: [
                { projectDetail: { status_id: 'desc' } },
                { outstandingProject: { is_outstanding: 'desc' } },
                { reviewedProject: { is_recommended: 'desc' } },
                { assessment: { grade: 'desc' } }
            ]
        });

        return formatProjects(projects);
    }

    /** The project with this id, as a one-element list (empty when there is none). */
    static async getProjectDetail(id: number) {
        const projects = await prisma.project.findMany({
            where: { id },
            include: projectWithChildren
        });
        return formatProjects(projects);
    }

    static async toggleProjectDisabled(projectId: number) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { is_disable: true }
        });
        if (!project) {
            throw new ServiceError("Project not found");
        }

        await prisma.project.update({
            where: { id: projectId },
            data: { is_disable: project.is_disable === 0 ? 1 : 0 }
        });
        return "Update completed successfully!";
    }

    /**
     * A lecturer's view of one class: its projects (with grades once the class
     * is finalized), the groups still waiting to submit, and the head counts.
     */
    static async listLecturerClassProjects(params: ClassFilter) {
        const classExists = await prisma.class.findFirst({ where: params });

        const projects = await prisma.project.findMany({
            where: { projectDetail: params },
            include: {
                ...projectWithChildren,
                assessment: !!classExists
            }
        });
        const updatedProjects = await formatProjects(projects);

        const totalStudents = await prisma.studentListTransaction.count({
            where: {
                semester_id: params.semester_id,
                course_code: params.course_id,
                class: params.class
            }
        });

        const sortedGroups = groupByNumber(await prisma.temporaryGroup.findMany({ where: params }));

        const studentsInProjectGroups = updatedProjects.reduce((sum, project) => sum + project.projectGroups.length, 0);
        const studentsInSortedGroups = sortedGroups.reduce((sum, group) => sum + group.students.length, 0);
        const countStudentSubmitted = studentsInProjectGroups + studentsInSortedGroups;

        return { updatedProjects, sortedGroups, totalStudents, countStudentSubmitted };
    }

    /** A lecturer's projects graded 4 or higher. */
    static async listLecturerGradedProjects(params: { lecturer_id: string; semester_id?: string | undefined; search?: string | undefined }) {
        const projects = await prisma.project.findMany({
            where: {
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
            },
            include: {
                ...projectWithChildren,
                assessment: true
            }
        });

        const goodProjects = projects.filter((project) => {
            return project.assessment?.grade !== undefined && project.assessment.grade >= 4;
        });
        return formatProjects(goodProjects);
    }

    /** A student's project in one class (graded once the class is finalized), plus the class's details. */
    static async listStudentClassProjects(params: ClassFilter & { student_id: string }) {
        const classFilter = {
            semester_id: params.semester_id,
            course_id: params.course_id,
            class: params.class
        };
        const classExists = await prisma.class.findFirst({ where: classFilter });

        const projects = await prisma.project.findMany({
            where: {
                projectDetail: classFilter,
                projectGroups: { some: { student_id: params.student_id } }
            },
            include: {
                ...projectWithChildren,
                assessment: !!classExists
            }
        });
        const updatedProjects = await formatProjects(projects);

        const classTransactions = await prisma.classTransaction.findFirst({
            where: {
                semester_id: params.semester_id,
                course_code: params.course_id,
                class: params.class
            }
        });

        return { updatedProjects, classTransactions };
    }

    /** Every project the student is a member of, newest first. */
    static async listStudentProjects(studentId: string) {
        const projects = await prisma.project.findMany({
            where: { projectGroups: { some: { student_id: studentId } } },
            include: {
                ...projectWithChildren,
                assessment: true
            },
            orderBy: { created_at: "desc" }
        });
        return formatProjects(projects);
    }
}
