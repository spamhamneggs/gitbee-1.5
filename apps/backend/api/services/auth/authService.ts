import { prisma } from "../../prisma/client.js";
import { hashPassword, verifyPassword } from "../../utils/auth/password.js";
import { DEV_BYPASS_USER } from "../../utils/auth/devBypass.js";
import { ServiceError } from "../../utils/response/response.js";
import AtlantisService, { type AtlantisAccountData } from "../atlantis/atlantisService.js";
import { getLocalNim, getLocalRoles } from "../../utils/auth/auth.js";

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
     * The account for a local credential login (email, NIM, or lecturer code),
     * or null. Unknown accounts and accounts without a password still pay for
     * one hash, so response time doesn't reveal which identifiers exist.
     */
    static async verifyLocalLogin(
        identifier: string,
        password: string,
        onUserResolved?: (userId: number) => boolean
    ) {
        const trimmed = identifier.trim();
        if (!trimmed) {
            await verifyPassword(password, DUMMY_PASSWORD_HASH);
            return null;
        }

        const user = trimmed.includes("@")
            ? await prisma.user.findUnique({
                  where: { email: trimmed.toLowerCase() },
                  select: localUserSelect,
              })
            : await prisma.user.findFirst({
                  where: {
                      OR: [
                          { student_id: trimmed },
                          { lecturer_code: trimmed.toUpperCase() },
                      ],
                  },
                  select: localUserSelect,
              });

        if (!user) {
            await verifyPassword(password, DUMMY_PASSWORD_HASH);
            return null;
        }

        if (onUserResolved?.(user.id)) {
            return null;
        }

        // The shared Prisma client masks User.password in query results.
        const credentials = await prisma.$queryRaw<Array<{ password: string | null }>>`
            SELECT password FROM user WHERE id = ${user.id} LIMIT 1
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
        // A failed lookup (not configured, unreachable, timed out, or no such
        // account) has no data, which leaves the email as the only match key.
        const atlantis = await AtlantisService.getAtlantisData(email);
        const atlantisAccount = atlantis.data as AtlantisAccountData | null;
        const username = atlantisAccount?.BinusianID ?? "";
        const lecturer_code = atlantisAccount?.KodeDosen ?? "";
        // A NIM of only spaces counts as no NIM; padding is not part of a NIM.
        const atlantisNim = atlantisAccount?.NIM?.trim() ?? "";

        const userLookupConditions = [
            { email: email },
            ...(lecturer_code ? [{ lecturer_code }] : []),
            ...(atlantisNim ? [{ student_id: atlantisNim }] : []),
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

        const roles = user ? getLocalRoles(user) : ["Student"];
        if (roles.length === 0) {
            throw new ServiceError("Invalid account role", 403);
        }
        const isStaff = !roles.includes("Student");
        // Unprovisioned students still use the NIM from Atlantis.
        const nim = user ? getLocalNim(user) : atlantisNim;
        if (user && !isStaff && !nim) {
            throw new ServiceError("Student account is missing its student_id (NIM). Please contact an administrator.", 401);
        }
        // Without a GitBee account the NIM can only come from Atlantis. Refuse
        // rather than start a session keyed on "", which matches no class,
        // group or project (see the v1.5 migration's impact-notes.md).
        if (!user && !nim) {
            if (atlantis.status === true) {
                throw new ServiceError("There is no GitBee account for this Microsoft account. Please ask an administrator to add you.", 403);
            }
            throw new ServiceError("Couldn't look up your account with BINUS's identity service. Please try again in a few minutes. If it keeps happening, ask an administrator to add your account.", 503);
        }

        return { user, isStaff, roles, nim, username };
    }
}
