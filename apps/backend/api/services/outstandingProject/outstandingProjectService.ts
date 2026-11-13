import { prisma } from "../../prisma/client.js";

export interface OutstandingDecisionInput {
    project_id: number;
    is_outstanding: number;
    feedback?: string | undefined;
}

export default class OutstandingProjectService {
    /** Head of Program decision: records whether the project is outstanding and moves it to Finalized (4). */
    static async recordDecision(params: OutstandingDecisionInput) {
        if (params.is_outstanding == 1 || params.is_outstanding == 0) {
            await prisma.outstandingProject.create({
                data: {
                    project_id: params.project_id,
                    is_outstanding: params.is_outstanding,
                    feedback: params.feedback ?? "",
                    created_at: new Date()
                }
            });
        }

        await prisma.projectDetail.update({
            where: { project_id: params.project_id },
            data: { status_id: 4 }
        });
        return "Project Successfully Finalized";
    }
}
