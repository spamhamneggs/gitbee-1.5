import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../utils/validator/validateSchema.js";
import {
    getErrorMessage,
    sendErrorResponse,
    sendServiceError,
    sendSuccessResponse,
    ServiceError,
} from "../../utils/response/response.js";
import { parseAndValidateCsvBuffer, type CsvUploadType } from "../../utils/csv/csvParser.js";
import { importCsvUsers } from "../../utils/csv/csvUserImport.js";
import UserService from "../../services/user/userService.js";
import ClassRosterService from "../../services/class/classRosterService.js";

const searchQuery = z.object({ search: z.string().optional() });

/** Admin endpoints under /user/admin: staff accounts, user imports, and the class lists imported from Excel. */
export default class UserHandler {
    static async listUsers(req: Request, res: Response) {
        try {
            const schema = z.object({
                roleFilter: z.string().optional(),
                search: z.string().optional(),
            });

            const validationResult = validateSchema(schema, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message || "Validation Failed");
            }

            sendSuccessResponse(res, await UserService.listUsersByRole(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async createUser(req: Request, res: Response) {
        try {
            const schema = z.object({
                lecturer_code: z.string().trim().min(1).max(50),
                email: z.string().trim().email().max(150),
                name: z.string().trim().min(1).max(150),
                role: z.enum(["Lecturer", "Admin", "SCC", "HoP"]),
                password: z.string().min(8).max(1024),
                major_ids: z.array(
                    z.string()
                        .regex(/^\d+$/)
                        .transform(Number)
                        .refine((id) => Number.isSafeInteger(id) && id > 0)
                ).refine((ids) => new Set(ids).size === ids.length, {
                    message: "Major IDs must be unique",
                }).optional(),
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await UserService.createUser(validationResult.data));
        } catch (error) {
            if (error instanceof ServiceError) {
                return sendErrorResponse(res, error.message, error.status);
            }
            sendErrorResponse(res, "Insert Failed", 500);
        }
    }

    static async setPassword(req: Request, res: Response) {
        try {
            const schema = z.object({
                id: z.number().int().positive(),
                password: z.string().min(8).max(1024),
            });
            const valid = schema.safeParse(req.body);
            if (!valid.success) {
                return sendErrorResponse(res, valid.error.issues[0]?.message ?? "Invalid request body", 400);
            }

            return sendSuccessResponse(res, await UserService.setPassword(valid.data.id, valid.data.password));
        } catch (error) {
            sendServiceError(res, error, "Password update failed");
        }
    }

    static async updateRole(req: Request, res: Response) {
        try {
            const schema = z.object({
                id: z.string(),
                role: z.string(),
                major_ids: z.array(z.string()).optional(),
            });

            const validationResult = validateSchema(schema, req.body);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.details);
            }

            sendSuccessResponse(res, await UserService.updateRole(validationResult.data));
        } catch (error) {
            sendServiceError(res, error, "Update Failed");
        }
    }

    static async importStudentsCsv(req: Request, res: Response) {
        return UserHandler.importUsersCsv(req, res, "student");
    }

    static async importStaffCsv(req: Request, res: Response) {
        return UserHandler.importUsersCsv(req, res, "staff");
    }

    private static async importUsersCsv(req: Request, res: Response, uploadType: CsvUploadType) {
        const file = req.file;
        if (!file) {
            return sendErrorResponse(res, "No file uploaded", 400);
        }

        let validation;
        try {
            validation = await parseAndValidateCsvBuffer(file.buffer, uploadType);
        } catch (error) {
            return sendErrorResponse(res, getErrorMessage(error, "Failed to parse CSV file."), 400);
        }
        if (validation.totalRows === 0) {
            return sendErrorResponse(res, "CSV file has no data rows.", 400);
        }

        try {
            return sendSuccessResponse(res, await importCsvUsers(validation));
        } catch (error) {
            return sendErrorResponse(res, getErrorMessage(error, "Failed to import CSV file."), 500);
        }
    }

    static async importLecturersExcel(req: Request, res: Response) {
        try {
            if (!req.file) {
                return sendErrorResponse(res, "No file uploaded.");
            }
            sendSuccessResponse(res, await UserService.importLecturersFromExcel(req.file.buffer));
        } catch (error) {
            sendServiceError(res, error, "Failed to process the Excel file.");
        }
    }

    static async deleteAllLecturers(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await UserService.deleteAllLecturers());
        } catch (error) {
            sendServiceError(res, error, "Remove Failed");
        }
    }

    static async listClassTransactions(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(searchQuery, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassRosterService.listClassTransactions(validationResult.data.search));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async importClassTransactionsExcel(req: Request, res: Response) {
        try {
            if (!req.file) {
                return sendErrorResponse(res, "No file uploaded.");
            }
            sendSuccessResponse(res, await ClassRosterService.importClassTransactionsFromExcel(req.file.buffer));
        } catch (error) {
            sendServiceError(res, error, "Failed to process the Excel file.");
        }
    }

    static async deleteAllClassTransactions(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await ClassRosterService.deleteAllClassTransactions());
        } catch (error) {
            sendServiceError(res, error, "Remove Failed");
        }
    }

    static async listStudentEnrolments(req: Request, res: Response) {
        try {
            const validationResult = validateSchema(searchQuery, req.query);
            if (validationResult.error) {
                return sendErrorResponse(res, validationResult.message);
            }

            sendSuccessResponse(res, await ClassRosterService.listStudentEnrolments(validationResult.data.search));
        } catch (error) {
            sendServiceError(res, error, "Fetch Failed");
        }
    }

    static async importStudentEnrolmentsExcel(req: Request, res: Response) {
        try {
            if (!req.file) {
                return sendErrorResponse(res, "No file uploaded.");
            }
            sendSuccessResponse(res, await ClassRosterService.importStudentEnrolmentsFromExcel(req.file.buffer));
        } catch (error) {
            sendServiceError(res, error, "Failed to process the Excel file.");
        }
    }

    static async deleteAllStudentEnrolments(_req: Request, res: Response) {
        try {
            sendSuccessResponse(res, await ClassRosterService.deleteAllStudentEnrolments());
        } catch (error) {
            sendServiceError(res, error, "Remove Failed");
        }
    }
}
