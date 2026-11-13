import { prisma } from "../../prisma/client.js";
import { hashPassword, verifyPassword } from "../../utils/auth/password.js";
import { DEV_BYPASS_USER } from "../../utils/auth/devBypass.js";
import { ServiceError } from "../../utils/response/response.js";
import AtlantisService, { type AtlantisAccountData } from "../atlantis/atlantisService.js";

const DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$Z2l0YmVlLWxvY2FsLWxvZ2luLWR1bW15LXNhbHQ=$wFAFffXSmSnjf95eUXNLQGx6IOgpXcbt/0yauPvSta/wt3Y85e6A9x17lhMJV8LyAqARq+3zt0t6doSwyqIfeA==";

const localUserSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    user_type: true,
    student_id: true,
    binusian_id: true,
    lecturer_code: true,
    credential_version: true,
} as const;

export default class AuthService {
    /**
     * The account for a local email/password login, or null. Unknown accounts
     * and accounts without a password still pay for one hash, so response time
     * doesn't reveal which emails exist.
     */
    static async verifyLocalLogin(email: string, password: string) {
        const user = await prisma.user.findUnique({
            where: { email },
            select: localUserSelect,
        });
        if (!user) {
            await verifyPassword(password, DUMMY_PASSWORD_HASH);
            return null;
        }

        // The shared Prisma client masks User.password in query results.
        const credentials = await prisma.$queryRaw<Array<{ password: string | null }>>`
            SELECT password FROM user WHERE email = ${user.email} LIMIT 1
        `;
        const passwordHash = credentials[0]?.password;
        if (!passwordHash) {
            await verifyPassword(password, DUMMY_PASSWORD_HASH);
            return null;
        }
        if (!(await verifyPassword(password, passwordHash))) {
            return null;
        }
        return user;
    }

    static findLocalUser(id: number) {
        return prisma.user.findUnique({
            where: { id },
            select: localUserSelect,
        });
    }

    /**
     * Replaces the user's password after checking the current one, and bumps
     * credential_version so every other session stops working. Returns the
     * account as it is after the change.
     */
    static async changePassword(userId: number, currentPassword: string, newPassword: string) {
        const user = await AuthService.findLocalUser(userId);
        if (!user) {
            throw new ServiceError("Unauthorized", 401);
        }

        const credentials = await prisma.$queryRaw<Array<{ password: string | null }>>`
            SELECT password FROM user WHERE id = ${userId} LIMIT 1
        `;
        const passwordHash = credentials[0]?.password;
        if (!passwordHash || !(await verifyPassword(currentPassword, passwordHash))) {
            throw new ServiceError("Invalid current password", 401);
        }

        const updatedVersion = user.credential_version + 1;
        await prisma.user.update({
            where: { id: userId },
            data: {
                password: await hashPassword(newPassword),
                credential_version: { increment: 1 },
            },
        });
        return { ...user, credential_version: updatedVersion };
    }

    /** The local dev admin used by the SSO bypass, created on first use. */
    static upsertDevBypassUser() {
        return prisma.user.upsert({
            where: { email: DEV_BYPASS_USER.email },
            update: {},
            create: DEV_BYPASS_USER,
            select: localUserSelect,
        });
    }

    /**
     * Who a Microsoft-authenticated email is: the local user row (matched by
     * email, lecturer code, NIM or Binusian ID from Atlantis), the roles that
     * gives them, and the NIM or lecturer code their session is keyed on.
     */
    static async resolveSsoAccount(email: string) {
        const atlantis = await AtlantisService.getAtlantisData(email);
        if (atlantis instanceof Error) {
            throw new ServiceError("Failed to fetch Binusian data", 401);
        }

        const atlantisAccount = atlantis.data as AtlantisAccountData | null;
        const username = atlantisAccount?.BinusianID ?? "";
        const lecturer_code = atlantisAccount?.KodeDosen ?? "";

        const userLookupConditions = [
            { email: email },
            ...(lecturer_code ? [{ lecturer_code }] : []),
            ...(atlantisAccount?.NIM ? [{ student_id: atlantisAccount.NIM }] : []),
            ...(atlantisAccount?.BinusianID ? [{ binusian_id: atlantisAccount.BinusianID }] : []),
        ];

        const user = await prisma.user.findFirst({
            where: {
                OR: userLookupConditions,
            },
            select: {
                id: true,
                lecturer_code: true,
                student_id: true,
                binusian_id: true,
                email: true,
                role: true,
                user_type: true,
                credential_version: true,
            },
        });

        // Students can have user rows too (role "Student", user_type "student"),
        // so a matched row alone doesn't make someone staff.
        const isStaff = user != null && user.role !== "Student" && user.user_type !== "student";

        const roles = isStaff
            ? user.role === "Lecturer"
                ? ["Lecturer"]
                : [user.role, "Lecturer"]
            : ["Student"];

        let nim: string;
        if (isStaff) {
            nim = user?.lecturer_code ?? "";
        } else if (user) {
            // A student account must carry its NIM. binusian_id is NOT a NIM and
            // cannot substitute for it: downstream student class/group queries
            // match on the NIM, so a wrong value silently returns no data.
            if (!user.student_id) {
                throw new ServiceError("Student account is missing its student_id (NIM). Please contact an administrator.", 401);
            }
            nim = user.student_id;
        } else {
            // No local user row yet (students are not guaranteed one): fall back to
            // Atlantis until every student account has been backfilled with a student_id.
            nim = atlantisAccount?.NIM ?? "";
        }

        return { user, isStaff, roles, nim, username };
    }
}
