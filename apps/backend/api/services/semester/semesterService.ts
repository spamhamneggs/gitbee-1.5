import axios from "axios";
import dotenv from "dotenv";

import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";
import { getErrors } from "../../utils/response/response.js";

dotenv.config();

export default class SemesterService {
    static async getAllSemesterData() : Promise<APIResponse> {
        try {
            const res = await axios.get(
                `${process.env.BLUEJACK_API}Semester/GetSemestersWithActiveDate`
            );

            return {
                message: "successful",
                status: true,
                data: res.data,
            };
    
        } catch (error) {
            const err = getErrors(error);
            return {
                ...defaultResponse,
                errors: err,
                data: null,
            };
        }
    }

    static async getCurrentSemesterData() : Promise<APIResponse> {
        try {
            const res = await axios.get(
                `${process.env.BLUEJACK_API}Semester/Active`
            );
                    
            return {
                message: "successful",
                status: true,
                data: res.data,
            };
    
        } catch (error) {
            const err = getErrors(error);
            return {
                ...defaultResponse,
                errors: err,
                data: null,
            };
        }
    }
}