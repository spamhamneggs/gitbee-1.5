import { prisma } from "../../prisma/client.js";
import { formatProjects } from "./projectService.js";

const projectWithChildren = {
    projectDetail: true,
    projectGroups: true,
    galleries: true,
    projectTechnologies: true
} as const;

const byGradeDesc = { assessment: { grade: "desc" } } as const;

/** Matches a project title, or a group member's NIM or name. */
const memberSearch = (search?: string) => search
    ? {
        OR: [
            { projectDetail: { title: { contains: search } } },
            {
                projectGroups: {
                    some: {
                        OR: [
                            { student_id: { contains: search } },
                            { student_name: { contains: search } }
                        ]
                    }
                }
            }
        ]
    }
    : {};

/** Adds the lecturer's name and the major, category and course names a reviewer sees on a card. */
async function withReviewDetails<T extends { lecturer_id: string; projectDetail: { major_id: number; category_id: number; course_id: string } | null }>(projects: T[]) {
    return Promise.all(projects.map(async (project) => {
        const lecturer = await prisma.user.findUnique({
            where: { lecturer_code: project.lecturer_id }
        });
        const major = await prisma.major.findUnique({
            where: { id: project.projectDetail!.major_id }
        });
        const category = await prisma.category.findUnique({
            where: { id: project.projectDetail!.category_id }
        });
        const course = await prisma.classTransaction.findFirst({
            where: { course_code: project.projectDetail!.course_id }
        });

        return {
            ...project,
            lecturer_name: lecturer ? lecturer.name : null,
            projectDetail: {
                ...project.projectDetail,
                major_name: major ? major.name : null,
                category_name: category ? category.name : null,
                course_name: course ? course.course_name : null
            },
        };
    }));
}

export interface AdminDashboardFilters {
    search?: string | undefined;
    majorFilter?: string | undefined;
    categoryFilter?: string | undefined;
    semester_id?: string | undefined;
}

export default class ProjectDashboardService {
    /** Every project, split by workflow status (1 submitted … 4 outstanding). */
    static async getAdminDashboard(params: AdminDashboardFilters) {
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
        const graded = (statusId: number) => prisma.project.findMany({
            where: whereConditions(statusId),
            include: { ...projectWithChildren, assessment: true },
            orderBy: byGradeDesc
        });

        const [submitted, gradedProjects, reviewed, outstanding] = await Promise.all([
            prisma.project.findMany({
                where: whereConditions(1),
                include: projectWithChildren
            }),
            graded(2),
            graded(3),
            graded(4)
        ]);
        const [formattedSubmitted, formattedGraded, formattedReviewed, formattedOutstanding] = await Promise.all([
            formatProjects(submitted),
            formatProjects(gradedProjects),
            formatProjects(reviewed),
            formatProjects(outstanding)
        ]);

        return {
            "count submitted": formattedSubmitted.length,
            "count graded": formattedGraded.length,
            "count reviewed": formattedReviewed.length,
            "count outstanding": formattedOutstanding.length,
            "submitted": formattedSubmitted,
            "graded": formattedGraded,
            "reviewed": formattedReviewed,
            "outstanding": formattedOutstanding
        };
    }

    /**
     * Head of Program: finalized projects of their major (optionally only
     * outstanding or not), and recommended ones still waiting for a decision.
     */
    static async getHopDashboard(params: { major_id: string; semester_id: string; is_outstanding?: string | undefined; search?: string | undefined }) {
        const searchCondition = memberSearch(params.search);
        const [reviewedProjects, notReviewedProjects] = await Promise.all([
            prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        major_id: Number(params.major_id),
                        status_id: 4
                    },
                    ...(params.is_outstanding ? { outstandingProject: { is_outstanding: Number(params.is_outstanding) } } : {}),
                    ...searchCondition
                },
                include: { ...projectWithChildren, assessment: true, outstandingProject: true },
                orderBy: byGradeDesc
            }),
            prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        major_id: Number(params.major_id),
                        status_id: 3
                    },
                    reviewedProject: { is_recommended: 1 },
                    ...searchCondition
                },
                include: { ...projectWithChildren, assessment: true },
                orderBy: byGradeDesc
            })
        ]);

        const reviewed = await withReviewDetails(await formatProjects(reviewedProjects));
        const notReviewed = await withReviewDetails(await formatProjects(notReviewedProjects));
        return {
            "count reviewed": reviewed.length,
            "count not reviewed": notReviewed.length,
            "reviewed": reviewed,
            "not reviewed": notReviewed
        };
    }

    /**
     * Subject Content Coordinator: projects already reviewed (optionally only
     * recommended or not), and graded ones scoring 4+ still waiting for review.
     */
    static async getSccDashboard(params: { semester_id: string; major_id?: string | undefined; is_recommended?: string | undefined; search?: string | undefined }) {
        const searchCondition = memberSearch(params.search);
        const majorCondition = params.major_id ? { major_id: Number(params.major_id) } : {};
        const [reviewedProjects, notReviewedProjects] = await Promise.all([
            prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        ...majorCondition,
                        status_id: { gte: 3 },
                    },
                    ...searchCondition,
                    ...(params.is_recommended ? { reviewedProject: { is_recommended: Number(params.is_recommended) } } : {}),
                },
                include: { ...projectWithChildren, assessment: true, reviewedProject: true },
                orderBy: byGradeDesc
            }),
            prisma.project.findMany({
                where: {
                    projectDetail: {
                        semester_id: params.semester_id,
                        ...majorCondition,
                        status_id: 2,
                    },
                    assessment: { grade: { gte: 4 } },
                    ...searchCondition
                },
                include: { ...projectWithChildren, assessment: true },
                orderBy: byGradeDesc
            })
        ]);

        const reviewed = await withReviewDetails(await formatProjects(reviewedProjects));
        const notReviewed = await withReviewDetails(await formatProjects(notReviewedProjects));
        return {
            "count reviewed": reviewed.length,
            "count not reviewed": notReviewed.length,
            "reviewed": reviewed,
            "not reviewed": notReviewed
        };
    }
}
