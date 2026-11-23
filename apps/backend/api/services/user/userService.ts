import { prisma } from "../../prisma/client.js";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { isStaffAccount, isStudentAccount, roleIs } from "../../utils/auth/localAccountSql.js";
import { hashPassword } from "../../utils/auth/password.js";
import type { staffRoles } from "../../utils/csv/csvParser.js";
import { ServiceError } from "../../utils/response/response.js";

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

export interface AccountListParams {
    search?: string | undefined;
    page: number;
    pageSize: number;
}

/**
 * Matches part of the given ID column, the Binusian ID, the email or the name.
 * "!" escapes the term's own "%" and "_", so they are searched for as typed
 * instead of acting as LIKE wildcards.
 */
const matchesSearch = (search: string | undefined, idColumn: Prisma.Sql) => {
    if (!search) {
        return Prisma.sql`TRUE`;
    }
    const term = `%${search.replace(/[!%_]/g, "!$&")}%`;
    return Prisma.sql`(${idColumn} LIKE ${term} ESCAPE '!' OR binusian_id LIKE ${term} ESCAPE '!' OR email LIKE ${term} ESCAPE '!' OR name LIKE ${term} ESCAPE '!')`;
};

type RawQueryClient = Pick<typeof prisma, "$queryRaw">;

/**
 * The ids on one page of the user rows matching `condition`, newest first, and
 * how many rows match in all. Which accounts count as students or staff is
 * decided in SQL (utils/auth/localAccountSql.ts), which Prisma's own filters
 * cannot express, so the matching, counting and paging happen here and the
 * caller loads the rows by id, in the same `pageSnapshot` transaction.
 */
async function pageOfUserIds(tx: RawQueryClient, condition: Prisma.Sql, params: AccountListParams) {
    // BigInt, because MySQL rejects a LIMIT or OFFSET parameter sent as a JS
    // number once it no longer fits in 32 bits.
    const take = BigInt(params.pageSize);
    const skip = BigInt(params.page - 1) * take;
    const counted = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM user WHERE ${condition}`);
    const page = await tx.$queryRaw<{ id: number }[]>(
        Prisma.sql`SELECT id FROM user WHERE ${condition} ORDER BY created_at DESC, id DESC LIMIT ${take} OFFSET ${skip}`
    );
    return { ids: page.map((row) => row.id), total: Number(counted[0]?.total ?? 0) };
}

/**
 * Options for the transaction that reads one page: the count, the page of ids
 * and the rows themselves. Under REPEATABLE READ all three see the snapshot
 * taken at the first read, so an account changed meanwhile (say, from Lecturer
 * to SCC) can't come back on a page it no longer belongs to.
 */
const pageSnapshot = { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead };

/** Rows loaded by id come back in no particular order; this puts them back in page order. */
const inPageOrder = <T extends { id: number }>(rows: T[], ids: number[]) => {
    const position = new Map(ids.map((id, index) => [id, index]));
    return [...rows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
};

export interface CreateUserInput {
    lecturer_code: string;
    email: string;
    name: string;
    role: "Lecturer" | "Admin" | "SCC" | "HoP";
    password: string;
    major_ids?: number[] | undefined;
}

export default class UserService {
    /** Staff accounts grouped by role; `roleFilter` limits the lookup to one role (the others come back null). */
    static async listUsersByRole(params: { roleFilter?: string | undefined; search?: string | undefined }) {
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
        const wants = (role: string) => params.roleFilter === role || !params.roleFilter;

        const scc = wants("SCC")
            ? await prisma.user.findMany({ where: { role: "SCC", ...searchCondition }, select: userListSelect })
            : null;

        let hop = null;
        if (wants("HoP")) {
            const hopData = await prisma.user.findMany({
                where: { role: "HoP", ...searchCondition },
                select: {
                    ...userListSelect,
                    hopMajors: { select: { major: { select: { id: true, name: true } } } },
                },
            });
            hop = hopData.map(({ hopMajors, ...user }) => ({
                ...user,
                hop_major: hopMajors.map((hm) => ({ id: hm.major.id, name: hm.major.name })),
            }));
        }

        const lecturer = wants("Lecturer")
            ? await prisma.user.findMany({ where: { role: "Lecturer", ...searchCondition }, select: userListSelect })
            : null;
        const admin = wants("Admin")
            ? await prisma.user.findMany({ where: { role: "Admin", ...searchCondition }, select: userListSelect })
            : null;

        return { scc, hop, lecturer, admin };
    }

    /**
     * Student accounts (what the student CSV import creates), newest first, one
     * page at a time: exactly the accounts login signs in as students.
     */
    static async listStudentAccounts(params: AccountListParams) {
        const condition = Prisma.sql`${isStudentAccount} AND ${matchesSearch(params.search, Prisma.sql`student_id`)}`;
        return prisma.$transaction(async (tx) => {
            const { ids, total } = await pageOfUserIds(tx, condition, params);
            const rows = ids.length === 0
                ? []
                : await tx.user.findMany({
                    where: { id: { in: ids } },
                    select: {
                        id: true,
                        student_id: true,
                        major_code: true,
                        name: true,
                        email: true,
                        binusian_id: true,
                        created_at: true,
                    },
                });
            return { items: inPageOrder(rows, ids), total, page: params.page, pageSize: params.pageSize };
        }, pageSnapshot);
    }

    /**
     * Staff accounts (what the staff CSV import and insert-user create), newest
     * first: exactly the accounts login signs in as staff. `roleFilter` narrows
     * the list to one role.
     */
    static async listStaffAccounts(params: AccountListParams & { roleFilter?: (typeof staffRoles)[number] | undefined }) {
        const condition = Prisma.sql`${isStaffAccount} AND ${params.roleFilter ? roleIs(params.roleFilter) : Prisma.sql`TRUE`} AND ${matchesSearch(params.search, Prisma.sql`lecturer_code`)}`;
        return prisma.$transaction(async (tx) => {
            const { ids, total } = await pageOfUserIds(tx, condition, params);
            const rows = ids.length === 0
                ? []
                : await tx.user.findMany({
                    where: { id: { in: ids } },
                    select: {
                        id: true,
                        lecturer_code: true,
                        major_codes: true,
                        name: true,
                        email: true,
                        binusian_id: true,
                        role: true,
                        created_at: true,
                        hopMajors: { select: { major: { select: { id: true, name: true } } } },
                    },
                });
            const items = inPageOrder(rows, ids).map(({ hopMajors, ...user }) => ({
                ...user,
                hop_major: hopMajors.map((hm) => ({ id: hm.major.id, name: hm.major.name })),
            }));
            return { items, total, page: params.page, pageSize: params.pageSize };
        }, pageSnapshot);
    }

    /** Creates a staff account with an initial local password (and, for a HoP, their majors). */
    static async createUser(params: CreateUserInput) {
        try {
            return await prisma.user.create({
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
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new ServiceError("A user with this email or lecturer code already exists.", 409);
                }
                if (error.code === "P2025") {
                    throw new ServiceError("One or more major IDs are invalid.", 400);
                }
            }
            throw error;
        }
    }

    /** Sets a new local password and revokes the account's existing sessions. */
    static async setPassword(id: number, password: string) {
        try {
            return await prisma.user.update({
                where: { id },
                data: {
                    password: await hashPassword(password),
                    credential_version: { increment: 1 },
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new ServiceError("User not found.", 404);
            }
            throw error;
        }
    }

    /** Changes a user's role; a HoP keeps the majors in `major_ids`, anyone leaving HoP loses theirs. */
    static async updateRole(params: { id: string; role: string; major_ids?: string[] | undefined }) {
        const userExists = await prisma.user.findUnique({
            where: { id: Number(params.id) },
            include: { hopMajors: true },
        });
        if (userExists && userExists.role === "HoP" && params.role !== "HoP") {
            await prisma.hoPMajor.deleteMany({
                where: { user_id: userExists.id },
            });
        }

        const updatedUserRole = await prisma.user.update({
            where: { id: Number(params.id) },
            data: { role: params.role },
        });

        if (params.role == "HoP" && params.major_ids) {
            await prisma.hoPMajor.deleteMany({
                where: { user_id: Number(params.id) },
            });
            await prisma.hoPMajor.createMany({
                data: params.major_ids.map((major_id) => ({
                    user_id: Number(params.id),
                    major_id: Number(major_id),
                })),
                skipDuplicates: true,
            });
        }

        return updatedUserRole;
    }

    /** Deletes every Lecturer account that isn't a student's. */
    static deleteAllLecturers() {
        return prisma.user.deleteMany({
            where: {
                role: "Lecturer",
                // Keep accounts that authHandler treats as students. user_type is
                // nullable, so NULL must be matched explicitly: in SQL, NOT
                // (user_type = 'student') is NULL (and thus excluded) when user_type IS NULL.
                OR: [{ user_type: null }, { user_type: { not: "student" } }],
            },
        });
    }
}
