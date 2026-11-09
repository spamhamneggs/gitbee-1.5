import { prisma } from "../../prisma/client.js";

export interface ClassRef {
    semester_id: string;
    course_id: string;
    class: string;
}

export interface StudentIdentity {
    student_id: string;
    student_name: string;
    student_binusian_id: string;
}

interface UserIdentity {
    name: string;
    binusian_id: string | null;
}

// MySQL's utf8mb4_unicode_ci matches IDs case-insensitively, so the in-memory
// lookups have to as well, or a roster row MySQL returned would look missing.
const idKey = (studentId: string) => studentId.trim().toLowerCase();

const firstFilled = (...values: (string | null | undefined)[]) =>
    values.find((value): value is string => typeof value === "string" && value.trim() !== "");

/** Trims the IDs, drops blank entries (an unused member slot) and repeats, keeping the first spelling. */
export function normalizeStudentIds(studentIds: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of studentIds) {
        const studentId = raw.trim();
        if (!studentId || seen.has(idKey(studentId))) continue;
        seen.add(idKey(studentId));
        result.push(studentId);
    }
    return result;
}

/**
 * The name and Binusian ID stored for a group member: the student's user row
 * first, then the name on the class roster, then the NIM itself, so a member is
 * never saved with an empty name.
 */
export function toStudentIdentity(
    studentId: string,
    user: UserIdentity | undefined,
    rosterName: string | undefined
): StudentIdentity {
    return {
        student_id: studentId,
        student_name: firstFilled(user?.name, rosterName) ?? studentId,
        student_binusian_id: firstFilled(user?.binusian_id) ?? studentId,
    };
}

export default class StudentService {
    /**
     * Checks the IDs against the class roster (student_list_transaction) and
     * resolves each enrolled member's name from the user table.
     * `notEnrolled` lists the IDs that are not on this class's roster.
     */
    static async resolveClassMembers(classRef: ClassRef, studentIds: string[]) {
        const ids = normalizeStudentIds(studentIds);
        if (ids.length === 0) {
            return { members: [] as StudentIdentity[], notEnrolled: [] as string[] };
        }

        const [rosterRows, users] = await Promise.all([
            prisma.studentListTransaction.findMany({
                where: {
                    semester_id: classRef.semester_id,
                    course_code: classRef.course_id,
                    class: classRef.class,
                    student_id: { in: ids },
                },
                select: { student_id: true, student_name: true },
            }),
            prisma.user.findMany({
                where: { student_id: { in: ids } },
                select: { student_id: true, name: true, binusian_id: true },
            }),
        ]);

        const rosterById = new Map(rosterRows.map((row) => [idKey(row.student_id), row]));
        const userById = new Map(
            users.flatMap((user) => (user.student_id ? [[idKey(user.student_id), user] as const] : []))
        );

        const members: StudentIdentity[] = [];
        const notEnrolled: string[] = [];
        for (const studentId of ids) {
            const rosterRow = rosterById.get(idKey(studentId));
            if (!rosterRow) {
                notEnrolled.push(studentId);
                continue;
            }
            // Store the roster's spelling of the ID so later lookups match it exactly.
            members.push(toStudentIdentity(rosterRow.student_id, userById.get(idKey(studentId)), rosterRow.student_name));
        }
        return { members, notEnrolled };
    }

    /** The student's name from the user table, else from any class roster; null when neither knows the NIM. */
    static async findStudentName(studentId: string): Promise<string | null> {
        const user = await prisma.user.findUnique({
            where: { student_id: studentId },
            select: { name: true },
        });
        const userName = firstFilled(user?.name);
        if (userName) return userName;

        const rosterRow = await prisma.studentListTransaction.findFirst({
            where: { student_id: studentId, student_name: { not: "" } },
            orderBy: { id: "desc" },
            select: { student_name: true },
        });
        return firstFilled(rosterRow?.student_name) ?? null;
    }
}
