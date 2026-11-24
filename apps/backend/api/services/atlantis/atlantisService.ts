import axios from "axios";
import validateSchema from "../../utils/validator/validateSchema.js";
import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";
import { atlantisSchema } from "../../models/generic/generic.js";
import { getErrors } from "../../utils/response/response.js";
import { externalApi } from "../../utils/http/externalApi.js";

export interface AtlantisAccountData {
    NIM?: string | null;
    BinusianID?: string;
    KodeDosen?: string;
    Name?: string;
    email?: { Email?: string }[];
}

/**
 * An Atlantis lookup. `notFound` marks a definitive answer that there is no
 * such account, as opposed to a lookup that couldn't be made.
 */
export type AtlantisResult = APIResponse & { notFound?: boolean };

/**
 * Atlantis answers in JSON, so only a 404 with a JSON object body counts as its
 * "no such account". An HTML page or an empty body comes from something in
 * front of it (a proxy, or an ATLANTIS_API with the wrong path) and counts as
 * a lookup that failed. (Inferred from the API's other answers; Atlantis's
 * exact 404 body hasn't been checked.)
 */
const isAtlantisMiss = (error: unknown) =>
    axios.isAxiosError(error) && error.response?.status === 404 &&
    typeof error.response.data === "object" && error.response.data !== null && !Array.isArray(error.response.data);

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
                notFound: isAtlantisMiss(error),
            };
        }
    }
}
