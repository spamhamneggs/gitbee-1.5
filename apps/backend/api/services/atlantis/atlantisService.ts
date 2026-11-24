import axios from "axios";
import validateSchema from "../../utils/validator/validateSchema.js";
import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";
import { atlantisSchema } from "../../models/generic/generic.js";
import { getErrors } from "../../utils/response/response.js";
import { externalApi } from "../../utils/http/externalApi.js";

export interface AtlantisAccountData {
    NIM?: string;
    BinusianID?: string;
    KodeDosen?: string;
    Name?: string;
    email?: { Email?: string }[];
}

/**
 * An Atlantis lookup. `notFound` marks a definitive answer that there is no
 * such account (a 404), as opposed to a lookup that couldn't be made.
 */
export type AtlantisResult = APIResponse & { notFound?: boolean };

// Atlantis is BINUS's identity API. Its only caller is Microsoft SSO login
// (AuthService.resolveSsoAccount); everything else reads the local user table.
export default class AtlantisService {
    static async getAtlantisData(credential: string): Promise<AtlantisResult> {
        try {
            const atlantisApi = process.env.ATLANTIS_API;
            if (!atlantisApi) {
                throw new Error("ATLANTIS_API is not configured");
            }
            const res = await externalApi().get(atlantisApi, {
                params: {
                    input: credential,
                },
            });
            const validationResult = validateSchema(atlantisSchema, res.data);

            if (validationResult.error) {
                return {
                    ...defaultResponse,
                    errors: validationResult.details,
                    data: null,
                };
            }

            return {
                message: "successful",
                status: true,
                data: validationResult.data,
            };
        } catch (error) {
            const err = getErrors(error);
            return {
                ...defaultResponse,
                errors: err,
                data: null,
                notFound: axios.isAxiosError(error) && error.response?.status === 404,
            };
        }
    }
}
