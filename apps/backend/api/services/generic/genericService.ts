import validateSchema from "../../utils/validator/validateSchema.js";
import { defaultResponse } from "../../models/generic/response.js";
import type { APIResponse } from "../../models/generic/response.js";

export interface AtlantisAccountData {
    NIM?: string;
    BinusianID?: string;
    KodeDosen?: string;
    Name?: string;
    email?: { Email?: string }[];
}
import axios from "axios";
import dotenv from "dotenv";
import { atlantisSchema } from "../../models/generic/generic.js";
import { getErrors } from "../../utils/response/response.js";

dotenv.config();

export default class GenericService {
  static async getAtlantisData (credential: string) : Promise<APIResponse> {
    try {
      const atlantisApi = process.env.ATLANTIS_API;
      if (!atlantisApi) {
        throw new Error("ATLANTIS_API is not configured");
      }
      const res = await axios.get(atlantisApi, {
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
      };
    }
  };
}
