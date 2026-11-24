import { prisma } from "../../prisma/client.js";
import { getLocalNim, getLocalRoles } from "./auth.js";

type SessionUser = {
  id: number;
  email: string;
  role: string;
  user_type: string | null;
  student_id: string | null;
  lecturer_code: string | null;
  credential_version: number;
};

type CurrentSessionResult =
  | { status: "current"; user: SessionUser }
  | { status: "invalid" }
  | { status: "untracked" };

export function isUnprovisionedSsoStudent(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload) &&
    !("userId" in payload) &&
    "authMethod" in payload && payload.authMethod === "sso" &&
    "unprovisionedStudent" in payload && payload.unprovisionedStudent === true &&
    "nim" in payload && typeof payload.nim === "string" && payload.nim.trim() !== "" &&
    "role" in payload && Array.isArray(payload.role) &&
    payload.role.length === 1 && payload.role[0] === "Student" &&
    (!("activeRole" in payload) || payload.activeRole === undefined || payload.activeRole === "Student");
}

export async function resolveCurrentSession(payload: unknown): Promise<CurrentSessionResult> {
  if (typeof payload !== "object" || payload === null) {
    return { status: "untracked" };
  }

  const hasUserId = "userId" in payload;
  if (hasUserId && (
    typeof payload.userId !== "number" ||
    !Number.isSafeInteger(payload.userId) ||
    payload.userId <= 0
  )) {
    return { status: "invalid" };
  }

  const email = "email" in payload && typeof payload.email === "string"
    ? payload.email.toLowerCase()
    : undefined;
  if (!hasUserId && !email) {
    return { status: "untracked" };
  }

  const select = {
      id: true,
      email: true,
      role: true,
      user_type: true,
      student_id: true,
      lecturer_code: true,
      credential_version: true,
  } as const;
  const user = hasUserId
    ? await prisma.user.findUnique({
      where: { id: payload.userId as number },
      select,
    })
    : await prisma.user.findUnique({
      where: { email: email! },
      select,
    });
  if (!user) {
    return hasUserId
      ? { status: "invalid" }
      : { status: "untracked" };
  }

  const tokenVersion = "credentialVersion" in payload
    ? payload.credentialVersion
    : 0;
  if (
    typeof tokenVersion !== "number" ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 0 ||
    user.credential_version !== tokenVersion
  ) {
    return { status: "invalid" };
  }

  const roles = getLocalRoles(user);
  const tokenRoles = "role" in payload ? payload.role : undefined;
  const authMethod = "authMethod" in payload ? payload.authMethod : undefined;
  const isSso = authMethod === "sso" ||
    (authMethod === undefined && "microsoftToken" in payload && Boolean(payload.microsoftToken));
  // Only SSO bound to this database ID can keep an upstream email alias.
  const allowsEmailAlias = isSso && hasUserId;
  if (!("nim" in payload) || payload.nim !== getLocalNim(user) ||
    (!allowsEmailAlias && email !== user.email.toLowerCase()) ||
    !Array.isArray(tokenRoles) || roles.length === 0 ||
    roles.length !== tokenRoles.length || roles.some((role) => !tokenRoles.includes(role)) ||
    ("activeRole" in payload && payload.activeRole !== undefined &&
      (typeof payload.activeRole !== "string" || !roles.includes(payload.activeRole)))) {
    return { status: "invalid" };
  }

  return { status: "current", user };
}
