import type { Request, Response } from "express";
import SemesterService from "../../services/semester/semesterService.js";
import type { APIResponse } from "../../models/generic/response.js";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/response/response.js";

const sendBluejackResult = (res: Response, result: APIResponse) => {
    if (result.status === true && result.data) {
        sendSuccessResponse(res, result.data);
    } else {
        sendErrorResponse(res, result.errors ? result.errors : "Fetch Failed");
    }
};

export default class SemesterHandler {
    static async listSemesters(_req: Request, res: Response) {
        sendBluejackResult(res, await SemesterService.getAllSemesterData());
    }

    static async getCurrentSemester(_req: Request, res: Response) {
        sendBluejackResult(res, await SemesterService.getCurrentSemesterData());
    }
}
