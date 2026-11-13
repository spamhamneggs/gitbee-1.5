import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { ServiceError } from "../../utils/response/response.js";
import StudentService, { type ClassRef } from "../student/studentService.js";

/** Rows of a class's temporary groups, bucketed by group number in ascending order. */
export function groupByNumber<T extends { group: number }>(rows: T[]) {
    const byGroup = rows.reduce<Record<string, T[]>>((acc, current) => {
        const list = acc[current.group] ?? [];
        list.push(current);
        acc[current.group] = list;
        return acc;
    }, {});

    return Object.keys(byGroup)
        .sort((a, b) => Number(a) - Number(b))
        .map((group) => ({
            group: Number(group),
            students: byGroup[group] ?? []
        }));
}

export default class GroupService {
    /**
     * Reserves the next free group number in a class for the given students.
     * Every member must be on the class roster and in no other group or project
     * for this class.
     */
    static async createGroup(classRef: ClassRef, requestedIds: string[]) {
        // Check the members against the class roster and read their names
        // before taking the serializable locks below (and their retries).
        const { members, notEnrolled } = await StudentService.resolveClassMembers(classRef, requestedIds);
        if (notEnrolled.length > 0) {
            throw new ServiceError(`Not enrolled in this class: ${notEnrolled.join(", ")}`);
        }
        if (members.length === 0) {
            throw new ServiceError("Choose at least one group member");
        }
        const studentIds = members.map((member) => member.student_id);
        const whereCondition = {
            semester_id: classRef.semester_id,
            course_id: classRef.course_id,
            class: classRef.class
        };

        for (let attempt = 0; ; attempt++) {
            try {
                const insertedGroups = await prisma.$transaction(async (tx) => {
                    const [existingMember, existingProject] = await Promise.all([
                        tx.temporaryGroup.findFirst({
                            where: { ...whereCondition, student_id: { in: studentIds } },
                            select: { id: true }
                        }),
                        tx.project.findFirst({
                            where: {
                                projectDetail: whereCondition,
                                projectGroups: { some: { student_id: { in: studentIds } } }
                            },
                            select: { id: true }
                        })
                    ]);
                    if (existingMember || existingProject) return null;

                    const [temporaryGroups, projectGroups] = await Promise.all([
                        tx.temporaryGroup.findMany({ where: whereCondition, select: { group: true } }),
                        tx.projectDetail.findMany({ where: whereCondition, select: { group: true } })
                    ]);
                    const usedNumbers = new Set([...temporaryGroups, ...projectGroups].map((row) => row.group));
                    let group = 1;
                    while (usedNumbers.has(group)) group++;

                    return Promise.all(members.map((member) => tx.temporaryGroup.create({
                        data: { ...whereCondition, group, ...member }
                    })));
                }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

                if (!insertedGroups) {
                    throw new ServiceError("One Of The Group Members Has Already Created A Group");
                }
                return insertedGroups;
            } catch (error) {
                // Serializable allocations can deadlock; retry from a fresh snapshot.
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
                    if (attempt < 4) continue;
                    throw new ServiceError("Another group is being created. Please try again.", 409);
                }
                throw error;
            }
        }
    }

    /** All members of the group the student belongs to in this class, or [] when they have none. */
    static async getStudentGroup(classRef: ClassRef, studentId: string) {
        const currentStudentGroup = await prisma.temporaryGroup.findFirst({
            where: { ...classRef, student_id: studentId }
        });
        if (!currentStudentGroup) {
            return [];
        }

        return prisma.temporaryGroup.findMany({
            where: { ...classRef, group: currentStudentGroup.group }
        });
    }

    static deleteGroup(classRef: ClassRef, group: number) {
        return prisma.temporaryGroup.deleteMany({
            where: { ...classRef, group }
        });
    }
}
