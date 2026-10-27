import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "../../../utils/validator/validateSchema.js";
import {
  getErrorMessage,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../../utils/response/response.js";
import { prisma } from "../../../prisma/client.js";
import xlsx from "xlsx";
import SemesterService from "../../../services/semester/semesterService.js";
import {
  parseAndValidateCsvBuffer,
  type CsvUploadType,
} from "../../../utils/csv/csvParser.js";
import {
  importCsvUsers,
} from "../../../utils/csv/csvUserImport.js";
import { hashPassword } from "../../../utils/auth/password.js";
import { Prisma } from "../../../prisma/generated/prisma/client.js";

interface AtlantisSemester {
  Description: string;
  SemesterID: string;
}

const userListSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  user_type: true,
  binusian_id: true,
  student_id: true,
  lecturer_code: true,
  created_at: true,
} as const;

export default class AdminUserHandler {
  static async getUser(req: Request, res: Response) {
    try {
      const schema = z.object({
        roleFilter: z.string().optional(),
        search: z.string().optional(),
      });

      const validationResult = validateSchema(schema, req.query);
      if (validationResult.error) {
        return sendErrorResponse(
          res,
          validationResult.message || "Validation Failed"
        );
      }

      const params = validationResult.data;
      const searchCondition = params.search
        ? {
            OR: [
              { lecturer_code: { contains: params.search } },
              { student_id: { contains: params.search } },
              { binusian_id: { contains: params.search } },
              { email: { contains: params.search } },
              { name: { contains: params.search } },
            ],
          }
        : {};

      let scc = null;
      let hop = null;
      let lecturer = null;
      let admin = null;

      if (params.roleFilter === "SCC" || !params.roleFilter) {
        scc = await prisma.user.findMany({
          where: {
            role: "SCC",
            ...searchCondition,
          },
          select: userListSelect,
        });
      }

      if (params.roleFilter === "HoP" || !params.roleFilter) {
        const hopData = await prisma.user.findMany({
          where: {
            role: "HoP",
            ...searchCondition,
          },
          select: {
            ...userListSelect,
            hopMajors: {
              select: {
                major: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
        hop = hopData.map(({ hopMajors, ...user }) => ({
          ...user,
          hop_major: hopMajors.map((hm) => ({
            id: hm.major.id,
            name: hm.major.name,
          })),
        }));
      }

      if (params.roleFilter === "Lecturer" || !params.roleFilter) {
        lecturer = await prisma.user.findMany({
          where: {
            role: "Lecturer",
            ...searchCondition,
          },
          select: userListSelect,
        });
      }

      if (params.roleFilter === "Admin" || !params.roleFilter) {
        admin = await prisma.user.findMany({
          where: {
            role: "Admin",
            ...searchCondition,
          },
          select: userListSelect,
        });
      }

      const response = {
        scc,
        hop,
        lecturer,
        admin,
      };

      sendSuccessResponse(res, response);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
    }
  }

  static async insertUser(req: Request, res: Response) {
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

      const params = validationResult.data;

      const newUser = await prisma.user.create({
        data: {
          lecturer_code: params.lecturer_code,
          email: params.email.toLowerCase(),
          name: params.name,
          role: params.role,
          password: await hashPassword(params.password),
          ...(params.role === "HoP" && params.major_ids
            ? {
                hopMajors: {
                  create: params.major_ids.map((major_id) => ({
                    major: { connect: { id: major_id } },
                  })),
                },
              }
            : {}),
        },
        select: {
          id: true,
          lecturer_code: true,
          email: true,
          name: true,
          role: true,
        },
      });

      sendSuccessResponse(res, newUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return sendErrorResponse(res, "A user with this email or lecturer code already exists.", 409);
        }
        if (error.code === "P2025") {
          return sendErrorResponse(res, "One or more major IDs are invalid.", 400);
        }
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
        return sendErrorResponse(
          res,
          valid.error.issues[0]?.message ?? "Invalid request body",
          400
        );
      }

      const user = await prisma.user.update({
        where: { id: valid.data.id },
        data: {
          password: await hashPassword(valid.data.password),
          credential_version: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
      return sendSuccessResponse(res, user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return sendErrorResponse(res, "User not found.", 404);
      }
      sendErrorResponse(res, getErrorMessage(error, "Password update failed"));
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

      const params = validationResult.data;
      const userExists = await prisma.user.findUnique({
        where: {
          id: Number(params.id),
        },
        include: {
          hopMajors: true,
        },
      });
      if (userExists && userExists.role === "HoP" && params.role !== "HoP") {
        await prisma.hoPMajor.deleteMany({
          where: {
            user_id: userExists.id,
          },
        });
      }

      const updatedUserRole = await prisma.user.update({
        where: {
          id: Number(params.id),
        },
        data: {
          role: params.role,
        },
      });

      if (params.role == "HoP" && params.major_ids) {
        await prisma.hoPMajor.deleteMany({
          where: {
            user_id: Number(params.id),
          },
        });

        const newHoPMajors = params.major_ids.map((major_id) => ({
          user_id: Number(params.id),
          major_id: Number(major_id),
        }));
        await prisma.hoPMajor.createMany({
          data: newHoPMajors,
          skipDuplicates: true,
        });
      }

      sendSuccessResponse(res, updatedUserRole);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Update Failed"));
    }
  }

  private static async handleCsvUpload(
    req: Request,
    res: Response,
    uploadType: CsvUploadType
  ) {
    const file = req.file;
    if (!file) {
      return sendErrorResponse(res, "No file uploaded", 400);
    }

    let validation;
    try {
      validation = await parseAndValidateCsvBuffer(file.buffer, uploadType);
    } catch (error) {
      return sendErrorResponse(
        res,
        getErrorMessage(error, "Failed to parse CSV file."),
        400
      );
    }
    if (validation.totalRows === 0) {
      return sendErrorResponse(res, "CSV file has no data rows.", 400);
    }

    try {
      return sendSuccessResponse(res, await importCsvUsers(validation));
    } catch (error) {
      return sendErrorResponse(
        res,
        getErrorMessage(error, "Failed to import CSV file."),
        500
      );
    }
  }

  static async handleStudentCsvUpload(req: Request, res: Response) {
    return AdminUserHandler.handleCsvUpload(req, res, "student");
  }

  static async handleStaffCsvUpload(req: Request, res: Response) {
    return AdminUserHandler.handleCsvUpload(req, res, "staff");
  }

  static async uploadUserExcel(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendErrorResponse(res, "No file uploaded.");
      }

      const schema = z.object({
        lecturer_code: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
      });

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return sendErrorResponse(res, "Excel file has no sheets.");
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return sendErrorResponse(res, "Excel sheet not found.");
      }
      const rows = xlsx.utils
        .sheet_to_json<unknown[][]>(worksheet, { header: 1 })
        .slice(1);

      const validatedUsers = rows.flatMap((row) => {
        const parsed = schema.safeParse({
          lecturer_code: row[2],
          name: row[1],
          email: row[1],
          role: "Lecturer",
        });
        return parsed.success ? [parsed.data] : [];
      });

      if (validatedUsers.length === 0) {
        return sendErrorResponse(res, "No valid rows found in the file.");
      }

      const createdUsers = await prisma.user.createMany({
        data: validatedUsers,
        skipDuplicates: true,
      });

      sendSuccessResponse(res, createdUsers);
    } catch (error) {
      sendErrorResponse(
        res,
        getErrorMessage(error, "Failed to process the Excel file.")
      );
    }
  }

  static async removeUserExcel(req: Request, res: Response) {
    try {
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          role: "Lecturer",
          // Keep accounts that authHandler treats as students. user_type is
          // nullable, so NULL must be matched explicitly: in SQL, NOT
          // (user_type = 'student') is NULL (and thus excluded) when user_type IS NULL.
          OR: [{ user_type: null }, { user_type: { not: "student" } }],
        },
      });

      sendSuccessResponse(res, deletedUsers);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Remove Failed"));
    }
  }

  static async getAllTransaction(req: Request, res: Response) {
    try {
      const schema = z.object({
        search: z.string().optional(),
      });

      const validationResult = validateSchema(schema, req.query);
      if (validationResult.error) {
        return sendErrorResponse(
          res,
          validationResult.message ? validationResult.message : "Fetch Failed"
        );
      }

      const params = validationResult.data;
      const whereCondition = {
        ...(params.search && {
          OR: [
            { lecturer_code: { contains: params.search } },
            { lecturer_name: { contains: params.search } },
            { course_code: { contains: params.search } },
            { course_name: { contains: params.search } },
            { class: { contains: params.search } },
          ],
        }),
      };
      const classTransactions = await prisma.classTransaction.findMany({
        where: whereCondition,
      });
      sendSuccessResponse(res, classTransactions);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
    }
  }

  static async uploadTransactionExcel(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendErrorResponse(res, "No file uploaded.");
      }

      const schema = z.object({
        semester_id: z.string(),
        lecturer_code: z.string(),
        lecturer_name: z.string(),
        course_code: z.string(),
        course_name: z.string(),
        class: z.string(),
        location: z.string(),
      });

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return sendErrorResponse(res, "Excel file has no sheets.");
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return sendErrorResponse(res, "Excel sheet not found.");
      }
      const rows = xlsx.utils
        .sheet_to_json<unknown[][]>(worksheet, { header: 1 })
        .slice(1);
      const firstRow = rows[0];
      if (!firstRow) {
        return sendErrorResponse(res, "Excel file is empty.");
      }
      const semesterRaw = firstRow[0];
      let semesterName = "";
      if (semesterRaw) {
        const numericRaw = Number(semesterRaw);
        if (!Number.isNaN(numericRaw)) {
          const yearPart = Math.floor(numericRaw / 100);
          const termPart = numericRaw % 100;
          const year = 2000 + yearPart;

          if (termPart === 10) {
            semesterName = `Odd Semester ${year}/${year + 1}`;
          } else if (termPart === 20) {
            semesterName = `Even Semester ${year}/${year + 1}`;
          }
        }
      }

      const semesterData = await SemesterService.getAllSemesterData();
      const semesters: unknown = semesterData.data;
      const semesterId = Array.isArray(semesters)
        ? semesters.find((semester: AtlantisSemester) => semester.Description === semesterName)
        : undefined;

      if (!semesterId) {
        return sendErrorResponse(res, "Invalid semester information.");
      }

      const uniqueCombinations = new Set<string>();
 
      const validatedTransactions = rows
        .map((row) => ({
          semester_id: semesterId.SemesterID,
          lecturer_code: row[2],
          lecturer_name: row[1],
          course_code: row[3],
          course_name: row[4],
          class: row[5],
          location: row[6],
        }))
        .filter((row) => {
          const uniqueKey = `${row.semester_id}|${String(row.lecturer_code)}|${String(row.course_code)}|${String(row.class)}|${String(row.location)}`;

          if (uniqueCombinations.has(uniqueKey)) {
            return false;
          }
          uniqueCombinations.add(uniqueKey);
          return true;
        })
        .flatMap((row) => {
          const parsed = schema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        });

      if (validatedTransactions.length === 0) {
        return sendErrorResponse(res, "No valid rows found in the file.");
      }

      const createdTransactions = await prisma.classTransaction.createMany({
        data: validatedTransactions,
        skipDuplicates: true,
      });

      sendSuccessResponse(res, createdTransactions);
    } catch (error) {
      sendErrorResponse(
        res,
        getErrorMessage(error, "Failed to process the Excel file.")
      );
    }
  }

  static async removeTransactionExcel(req: Request, res: Response) {
    try {
      const deletedTransactions = await prisma.classTransaction.deleteMany({});

      sendSuccessResponse(res, deletedTransactions);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Remove Failed"));
    }
  }

  static async getAllStudent(req: Request, res: Response) {
    try {
      const schema = z.object({
        search: z.string().optional(),
      });

      const validationResult = validateSchema(schema, req.query);
      if (validationResult.error) {
        return sendErrorResponse(
          res,
          validationResult.message ? validationResult.message : "Fetch Failed"
        );
      }

      const params = validationResult.data;
      const whereCondition = {
        ...(params.search && {
          OR: [
            { student_id: { contains: params.search } },
            { student_name: { contains: params.search } },
            { course_code: { contains: params.search } },
            { class: { contains: params.search } },
          ],
        }),
      };
      const studentTransactions = await prisma.studentListTransaction.findMany({
        where: whereCondition,
      });
      sendSuccessResponse(res, studentTransactions);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Fetch Failed"));
    }
  }

  static async uploadStudentExcel(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendErrorResponse(res, "No file uploaded.");
      }

      const schema = z.object({
        semester_id: z.string(),
        student_id: z.string(),
        student_name: z.string(),
        course_code: z.string(),
        class: z.string(),
      });

      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return sendErrorResponse(res, "Excel file has no sheets.");
      }
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return sendErrorResponse(res, "Excel sheet not found.");
      }
      const rows = xlsx.utils
        .sheet_to_json<unknown[][]>(worksheet, { header: 1 })
        .slice(1);

      const firstRow = rows[0];
      if (!firstRow) {
        return sendErrorResponse(res, "Excel file is empty.");
      }
      const semesterRaw = firstRow[2];
      let semesterName = "";
      if (semesterRaw) {
        const numericRaw = Number(semesterRaw);
        if (!Number.isNaN(numericRaw)) {
          const yearPart = Math.floor(numericRaw / 100);
          const termPart = numericRaw % 100;
          const year = 2000 + yearPart;

          if (termPart === 10) {
            semesterName = `Odd Semester ${year}/${year + 1}`;
          } else if (termPart === 20) {
            semesterName = `Even Semester ${year}/${year + 1}`;
          }
        }
      }

      const semesterData = await SemesterService.getAllSemesterData();
      const semesters: unknown = semesterData.data;
      const semesterId = Array.isArray(semesters)
        ? semesters.find((semester: AtlantisSemester) => semester.Description === semesterName)
        : undefined;

      if (!semesterId) {
        return sendErrorResponse(res, "Invalid semester information.");
      }
 
      const validatedTransactions = rows
        .map((row) => ({
          semester_id: semesterId.SemesterID,
          student_id:
            typeof row[0] === "string" || typeof row[0] === "number"
              ? String(row[0])
              : row[0],
          student_name: row[1],
          course_code: row[3],
          class: row[4],
        }))
        .flatMap((row) => {
          const parsed = schema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        })
        .filter((row) => row.class.startsWith("L"));

      if (validatedTransactions.length === 0) {
        return sendErrorResponse(res, "No valid rows found in the file.");
      }

      const createdTransactions =
        await prisma.studentListTransaction.createMany({
          data: validatedTransactions,
          skipDuplicates: true,
        });

      sendSuccessResponse(res, createdTransactions);
    } catch (error) {
      sendErrorResponse(
        res,
        getErrorMessage(error, "Failed to process the Excel file.")
      );
    }
  }

  static async removeStudentExcel(req: Request, res: Response) {
    try {
      const deletedTransactions =
        await prisma.studentListTransaction.deleteMany({});

      sendSuccessResponse(res, deletedTransactions);
    } catch (error) {
      sendErrorResponse(res, getErrorMessage(error, "Remove Failed"));
    }
  }
}
