import { z } from "zod";
import { prisma } from "../../prisma/client.js";
import { readFirstSheetRows, semesterNameFromTermCode } from "../../utils/excel/excelSheet.js";
import { ServiceError } from "../../utils/response/response.js";
import SemesterService, { type SemesterResult } from "../semester/semesterService.js";

interface BluejackSemester {
    Description: string;
    SemesterID: string;
}

const MAX_REASON_LENGTH = 200;

/**
 * A 503 for a semester list that couldn't be loaded. `errors` is the raw
 * response body, which can be a proxy's whole HTML error page, so Bluejack's
 * reason is added only when it's a short, one-line JSON `message`.
 */
function bluejackUnavailable(lookup: SemesterResult) {
    const body = lookup.errors;
    const message = typeof body === "object" && body !== null ? (body as { message?: unknown }).message : undefined;
    const reason = typeof message === "string" ? message.trim() : "";
    const showReason = reason !== "" && reason.length <= MAX_REASON_LENGTH && !/[\r\n]/.test(reason);
    return new ServiceError(
        `Couldn't load the semester list from Bluejack${showReason ? ` (${reason})` : ""}. Please try again in a few minutes.`,
        503,
    );
}

/**
 * The Bluejack semester whose description matches the term code. A term that
 * isn't in Bluejack's list is a 400; a list that couldn't be loaded is a 503,
 * since the file may well be fine.
 */
async function findSemesterByTermCode(raw: unknown) {
    const semesterName = semesterNameFromTermCode(raw);
    if (!semesterName) {
        throw new ServiceError("Invalid semester information.");
    }
    const findIn = (lookup: SemesterResult) => lookup.usable && Array.isArray(lookup.data)
        ? (lookup.data as BluejackSemester[]).find((candidate) => candidate.Description === semesterName)
        : undefined;
    let lookup = await SemesterService.getAllSemesterData();
    let semester = findIn(lookup);
    // The semester list is cached for an hour, so a semester Bluejack added
    // since then gets one fresh look before the file is rejected. A list that
    // was just fetched for this import is already fresh.
    if (!semester && lookup.fromCache) {
        lookup = await SemesterService.getAllSemesterData({ fresh: true });
        semester = findIn(lookup);
    }
    if (!semester) {
        throw lookup.usable ? new ServiceError("Invalid semester information.") : bluejackUnavailable(lookup);
    }
    return semester;
}

function firstDataRow(rows: unknown[][]) {
    const firstRow = rows[0];
    if (!firstRow) {
        throw new ServiceError("Excel file is empty.");
    }
    return firstRow;
}

/**
 * The class lists an admin imports from BINUS's Excel exports: class
 * transactions (which lecturer teaches which class) and student enrolments.
 */
export default class ClassRosterService {
    static listClassTransactions(search?: string) {
        return prisma.classTransaction.findMany({
            where: {
                ...(search && {
                    OR: [
                        { lecturer_code: { contains: search } },
                        { lecturer_name: { contains: search } },
                        { course_code: { contains: search } },
                        { course_name: { contains: search } },
                        { class: { contains: search } },
                    ],
                }),
            },
        });
    }

    /** Columns: term code, lecturer name, lecturer code, course code, course name, class, location. */
    static async importClassTransactionsFromExcel(buffer: Buffer) {
        const schema = z.object({
            semester_id: z.string(),
            lecturer_code: z.string(),
            lecturer_name: z.string(),
            course_code: z.string(),
            course_name: z.string(),
            class: z.string(),
            location: z.string(),
        });

        const rows = readFirstSheetRows(buffer);
        // The semester comes from the first row only (AR-09).
        const semester = await findSemesterByTermCode(firstDataRow(rows)[0]);

        const uniqueCombinations = new Set<string>();
        const validatedTransactions = rows
            .map((row) => ({
                semester_id: semester.SemesterID,
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
            throw new ServiceError("No valid rows found in the file.");
        }

        return prisma.classTransaction.createMany({
            data: validatedTransactions,
            skipDuplicates: true,
        });
    }

    static deleteAllClassTransactions() {
        return prisma.classTransaction.deleteMany({});
    }

    static listStudentEnrolments(search?: string) {
        return prisma.studentListTransaction.findMany({
            where: {
                ...(search && {
                    OR: [
                        { student_id: { contains: search } },
                        { student_name: { contains: search } },
                        { course_code: { contains: search } },
                        { class: { contains: search } },
                    ],
                }),
            },
        });
    }

    /** Columns: NIM, name, term code, course code, class. Only lab classes (class starting with "L") are kept. */
    static async importStudentEnrolmentsFromExcel(buffer: Buffer) {
        const schema = z.object({
            semester_id: z.string(),
            student_id: z.string(),
            student_name: z.string(),
            course_code: z.string(),
            class: z.string(),
        });

        const rows = readFirstSheetRows(buffer);
        const semester = await findSemesterByTermCode(firstDataRow(rows)[2]);

        const validatedTransactions = rows
            .map((row) => ({
                semester_id: semester.SemesterID,
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
            throw new ServiceError("No valid rows found in the file.");
        }

        return prisma.studentListTransaction.createMany({
            data: validatedTransactions,
            skipDuplicates: true,
        });
    }

    static deleteAllStudentEnrolments() {
        return prisma.studentListTransaction.deleteMany({});
    }
}
