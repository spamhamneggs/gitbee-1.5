import { StatusCodes } from "http-status-codes";
import { z, ZodError, ZodType } from "zod";

interface ValidationResult<T> {
  data: T | null;
  message: string;
  details: string[] | null;
  error: boolean;
  status: number | null;
}

const validateSchema = <T>(schema: z.ZodType<T>, object: any): ValidationResult<T> => {
  try {
    const parsed = schema.parse(object);
    return {
      data: parsed,
      message: "Success",
      details: null,
      error: false,
      status: null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((issue: any) => `${issue.path.join(".")} is ${issue.message}`);
      return {
        status: StatusCodes.BAD_REQUEST,
        message: "Invalid request data",
        error: true,
        details: messages,
        data: null,
      };
    } else {
      return {
        status: StatusCodes.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        error: true,
        details: ["Unknown error"],
        data: null,
      };
    }
  }
};

export default validateSchema;
