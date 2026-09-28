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

  static async getName(credential: string) : Promise<APIResponse<string>> {
    try {
      const result = await this.getAtlantisData(credential);

      let name = "";
      const account = result.data as AtlantisAccountData | null;
      if (account && Object.hasOwn(account, 'Name') && Object.hasOwn(account, 'email') && account.email) {
          const primaryEmail = account.email[0]?.Email ?? "";
          name = account.Name === "" ? primaryEmail : (account.Name ?? "");
      }

      return {
        message: "successful",
        status: true,
        data: name,
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

  static async getBinusianID(credential: string) : Promise<APIResponse<string>> {
    try {
      const result = await this.getAtlantisData(credential);

      let BinusianID = "";
      const account = result.data as AtlantisAccountData | null;
      if (account && Object.hasOwn(account, 'BinusianID') && Object.hasOwn(account, 'email') && account.email) {
        const primaryEmail = account.email[0]?.Email ?? "";
        BinusianID = account.BinusianID === "" ? primaryEmail : (account.BinusianID ?? "");
      }

      return {
        message: "successful",
        status: true,
        data: BinusianID,
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