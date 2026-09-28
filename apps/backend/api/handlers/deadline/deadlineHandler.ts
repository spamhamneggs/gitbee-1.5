import type { Request, Response } from "express";
import { sendSuccessResponse, sendErrorResponse } from "api/utils/response/response";
import { prisma } from "api/prisma/client";
import SemesterService from "api/services/semester/semesterService";


export default class DeadlineHandler {
    static async checkDeadline(req: Request, res: Response) {
        try {
            const result = await SemesterService.getCurrentSemesterData();
            const description = result.data.Description;
            const periode = description.split(" ")[0];

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
            return sendErrorResponse(res, error.message, 400);
        }
    }
}