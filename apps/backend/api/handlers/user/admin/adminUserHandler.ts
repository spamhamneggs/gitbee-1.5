import { z } from "zod";
import type { Request, Response } from "express";
import validateSchema from "api/utils/validator/validateSchema";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "api/utils/response/response";
import { prisma } from "api/prisma/client";
import xlsx from "xlsx";
import SemesterService from "api/services/semester/semesterService";


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
        });
      }

      if (params.roleFilter === "HoP" || !params.roleFilter) {
        const hopData = await prisma.user.findMany({
          where: {
            role: "HoP",
            ...searchCondition,
          },
          include: {
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
        hop = hopData.map((h) => ({
          ...h,
          hop_major: h.hopMajors.map((hm) => ({
            id: hm.major.id,
            name: hm.major.name,
          })),
        }));
        hop.forEach((h) => delete h.hopMajors);
      }

      if (params.roleFilter === "Lecturer" || !params.roleFilter) {
        lecturer = await prisma.user.findMany({
          where: {
            role: "Lecturer",
            ...searchCondition,
          },
        });
      }

      if (params.roleFilter === "Admin" || !params.roleFilter) {
        admin = await prisma.user.findMany({
          where: {
            role: "Admin",
            ...searchCondition,
          },
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
      sendErrorResponse(res, error.message || "Fetch Failed");
    }
  }

  static async insertUser(req: Request, res: Response) {
    try {
      const schema = z.object({
        lecturer_code: z.string(),
        email: z.string(),
        name: z.string(),
        role: z.string(),
        major_ids: z.array(z.string()).optional(),
      });

      const validationResult = validateSchema(schema, req.body);
      if (validationResult.error) {
        return sendErrorResponse(res, validationResult.details);
      }

      const params = validationResult.data;

      const newUser = await prisma.user.create({
        data: {
          lecturer_code: params.lecturer_code,
          email: params.email,
          name: params.name,
          role: params.role,
        },
      });

      if (params.role == "HoP" && params.major_ids) {
        const newHoPMajors = params.major_ids.map((major_id) => ({
          user_id: Number(newUser.id),
          major_id: Number(major_id),
        }));
        await prisma.hoPMajor.createMany({
          data: newHoPMajors,
        });
      }

      sendSuccessResponse(res, newUser);
    } catch (error) {
      sendErrorResponse(res, error.message ? error.message : "Insert Failed");
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
      sendErrorResponse(res, error.message ? error.message : "Update Failed");
    }
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
      const worksheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = xlsx.utils
        .sheet_to_json(worksheet, { header: 1 })
        .slice(1);

      const validatedUsers = rows
        .map((row) => ({
          lecturer_code: row[2],
          name: row[1],
          email: row[1],
          role: "Lecturer",
        }))
        .filter((row) => schema.safeParse(row).success);

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
        error.message || "Failed to process the Excel file."
      );
    }
  }

  static async removeUserExcel(req: Request, res: Response) {
    try {
      const deletedUsers = await prisma.user.deleteMany({
        where: {
          NOT: [{ role: "Admin" }, { role: "SCC" }, { role: "HoP" }],
        },
      });

      sendSuccessResponse(res, deletedUsers);
    } catch (error) {
      sendErrorResponse(res, error.message ? error.message : "Remove Failed");
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
      sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
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
      const worksheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = xlsx.utils
        .sheet_to_json(worksheet, { header: 1 })
        .slice(1);
      const semesterRaw = rows[0][0];
      let semesterName = "";
      if (semesterRaw) {
        const yearPart = Math.floor(semesterRaw / 100);
        const termPart = semesterRaw % 100;
        const year = 2000 + yearPart;

        if (termPart === 10) {
          semesterName = `Odd Semester ${year}/${year + 1}`;
        } else if (termPart === 20) {
          semesterName = `Even Semester ${year}/${year + 1}`;
        }
      }

      const semesterData = await SemesterService.getAllSemesterData();
      const semesterId = semesterData.data.find(
        (semester) => semester.Description === semesterName
      );

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
          const uniqueKey = `${row.semester_id}|${row.lecturer_code}|${row.course_code}|${row.class}|${row.location}`;

          if (uniqueCombinations.has(uniqueKey)) {
            return false;
          }
          uniqueCombinations.add(uniqueKey);
          return true;
        })
        .filter((row) => schema.safeParse(row).success);

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
        error.message || "Failed to process the Excel file."
      );
    }
  }

  static async removeTransactionExcel(req: Request, res: Response) {
    try {
      const deletedTransactions = await prisma.classTransaction.deleteMany({});

      sendSuccessResponse(res, deletedTransactions);
    } catch (error) {
      sendErrorResponse(res, error.message ? error.message : "Remove Failed");
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
      sendErrorResponse(res, error.message ? error.message : "Fetch Failed");
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
      const worksheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = xlsx.utils
        .sheet_to_json(worksheet, { header: 1 })
        .slice(1);

      const semesterRaw = rows[0][2];
      let semesterName = "";
      if (semesterRaw) {
        const yearPart = Math.floor(semesterRaw / 100);
        const termPart = semesterRaw % 100;
        const year = 2000 + yearPart;

        if (termPart === 10) {
          semesterName = `Odd Semester ${year}/${year + 1}`;
        } else if (termPart === 20) {
          semesterName = `Even Semester ${year}/${year + 1}`;
        }
      }

      const semesterData = await SemesterService.getAllSemesterData();
      const semesterId = semesterData.data.find(
        (semester) => semester.Description === semesterName
      );

      if (!semesterId) {
        return sendErrorResponse(res, "Invalid semester information.");
      }
 
      const validatedTransactions = rows
        .map((row) => ({
          semester_id: semesterId.SemesterID,
          student_id: row[0].toString(),
          student_name: row[1],
          course_code: row[3],
          class: row[4],
        }))
        .filter((row) => schema.safeParse(row).success)
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
        error.message || "Failed to process the Excel file."
      );
    }
  }

  static async removeStudentExcel(req: Request, res: Response) {
    try {
      const deletedTransactions =
        await prisma.studentListTransaction.deleteMany({});

      sendSuccessResponse(res, deletedTransactions);
    } catch (error) {
      sendErrorResponse(res, error.message ? error.message : "Remove Failed");
    }
  }
}
