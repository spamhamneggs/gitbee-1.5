import { prisma } from "../../prisma/client.js";

export interface GradeClassInput {
    semester_id: string;
    course_id: string;
    class: string;
    lecturer_id: string;
    assessments: { project_id: string; grade: number; reason?: string | undefined }[];
}

export default class AssessmentService {
    /** Grades every project of the class, marks them Graded (2) and finalizes the class, in one transaction. */
    static gradeClass(params: GradeClassInput) {
        return prisma.$transaction([
            ...params.assessments.map((assessment) =>
                prisma.assessment.create({
                    data: {
                        project_id: Number(assessment.project_id),
                        grade: assessment.grade,
                        reason: assessment.reason ?? "",
                        created_at: new Date()
                    }
                })
            ),

            ...params.assessments.map((assessment) =>
                prisma.projectDetail.update({
                    where: { project_id: Number(assessment.project_id) },
                    data: { status_id: 2 }
                })
            ),

            prisma.class.create({
                data: {
                    semester_id: params.semester_id,
                    course_id: params.course_id,
                    class: params.class,
                    lecturer_id: params.lecturer_id,
                    finalized_at: new Date()
                }
            })
        ]);
    }
}
