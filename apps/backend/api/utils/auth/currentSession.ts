import { prisma } from "../../prisma/client.js";

type SessionUser = {
  id: number;
  email: string;
  role: string;
  user_type: string | null;
  credential_version: number;
};

type CurrentSessionResult =
  | { status: "current"; user: SessionUser }
  | { status: "invalid" }
  | { status: "untracked" };

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

  return { status: "current", user };
}
