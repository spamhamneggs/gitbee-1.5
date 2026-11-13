import { prisma } from "../../prisma/client.js";

export interface ReviewInput {
    project_id: number;
    is_recommended: number;
    feedback?: string | undefined;
}

export default class ReviewedProjectService {
    /** SCC review: records whether the project is recommended and moves it to Reviewed (3). */
    static async recordReview(params: ReviewInput) {
        if (params.is_recommended == 1 || params.is_recommended == 0) {
            await prisma.reviewedProject.create({
                data: {
                    project_id: params.project_id,
                    is_recommended: params.is_recommended,
                    feedback: params.feedback ?? "",
                    created_at: new Date()
                }
            });
        }

        await prisma.projectDetail.update({
            where: { project_id: params.project_id },
            data: { status_id: 3 }
        });
        return "Project Successfully Reviewed";
    }
}
