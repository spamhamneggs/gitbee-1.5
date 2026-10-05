import type { Request, Response } from "express";
import { getErrorMessage, sendSuccessResponse, sendErrorResponse } from "../../utils/response/response.js";
import { prisma } from "../../prisma/client.js";
import SemesterService from "../../services/semester/semesterService.js";


export default class DeadlineHandler {
    static async checkDeadline(req: Request, res: Response) {
        try {
            const result = await SemesterService.getCurrentSemesterData();
            const semesterData: unknown = result.data;
            const description = typeof semesterData === "object" && semesterData !== null && "Description" in semesterData && typeof semesterData.Description === "string" ? semesterData.Description : "";
            const periode = description.split(" ")[0] ?? "";

            const deadline = await prisma.deadline.findFirst({
                where: { periode },
            });

            if (!deadline || !deadline.deadline_at) {
                return sendErrorResponse(res, "Deadline not found", 404);
            }

            const currentYear = new Date().getFullYear();
            const deadlineString = `${deadline.deadline_at} ${currentYear}`;
            const deadlineDate = new Date(deadlineString);

            if (isNaN(deadlineDate.getTime())) {
                return sendErrorResponse(res, "Invalid deadline format", 400);
            }

            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            deadlineDate.setHours(0, 0, 0, 0);

            const timeDifference = deadlineDate.getTime() - currentDate.getTime();
            const daysRemaining = timeDifference / (1000 * 3600 * 24);

            const isDeadline = currentDate > deadlineDate;
            const isCloseToDeadline = daysRemaining >= 0 && daysRemaining <= 14;

            sendSuccessResponse(res, {
                periode,
                deadline_at: deadline.deadline_at,
                isDeadline,
                isCloseToDeadline, 
            });

        } catch (error) {
            return sendErrorResponse(res, getErrorMessage(error), 400);
        }
    }
}