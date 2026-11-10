import type { Session } from "@/lib/auth";

type LoginResult =
  | { success: true; data: Session }
  | { success: false; message: string };

export const getSession = async (signal?: AbortSignal): Promise<Session | null> => {
  const deadline = AbortSignal.timeout(10_000);
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API}auth/session`, {
    credentials: "include",
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  });
  if (response.status === 401) return null;
  const result = await response.json() as { status?: boolean; data?: Session; errors?: string };
  if (!response.ok || !result.status || !result.data) {
    throw new Error(result.errors ?? "Couldn't load the session.");
  }
  return result.data;
};

// The session comes from the response that sets the cookie, so a second request
// cannot fail after the server has already changed the signed-in identity.
const sessionResult = (session?: Session): LoginResult =>
  session
    ? { success: true, data: session }
    : { success: false, message: "The backend returned no session. Please sign in again." };

export const login = async (microsoftToken: string, role?: string): Promise<LoginResult> => {
  try {
    const responselogin = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ microsoft_token: microsoftToken, role: role }),
      }
    );

    const resultlogin = await responselogin.json() as {
      status?: boolean; errors?: string; message?: string; data?: { session?: Session };
    };
    if (responselogin.ok && resultlogin.status) {
      return sessionResult(resultlogin.data?.session);
    } else {
      return { success: false, message: resultlogin.errors ?? resultlogin.message ?? "Login failed" };
    }
  } catch {
    return { success: false, message: "Couldn't sign in. Please try again." };
  }
};

// Every login method switches with its verified session cookie.
export const switchRole = async (role: string): Promise<LoginResult> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/session/role`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      }
    );
    const result = await response.json() as { status?: boolean; errors?: string; data?: { session?: Session } };
    if (response.ok && result.status) {
      return sessionResult(result.data?.session);
    }
    return { success: false, message: result.errors ?? "Role switch failed" };
  } catch {
    return { success: false, message: "Couldn't switch roles. Please try again." };
  }
};

// Signs in as the backend's local dev account (BYPASS_SSO only). Failures
// come back with a message meant for the developer looking at the page.
export const loginDevBypass = async (): Promise<LoginResult> => {
  let response: Response;
  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login-dev`,
      {
        method: "POST",
        credentials: "include",
      }
    );
  } catch {
    return {
      success: false,
      message: `Couldn't reach the backend at ${process.env.NEXT_PUBLIC_BACKEND_API}. Is it running?`,
    };
  }

  const result = await response.json().catch(() => null);
  if (response.ok && result?.status) {
    return sessionResult(result.data?.session);
  }
  if (response.status === 404) {
    return {
      success: false,
      message:
        "The backend has the SSO bypass turned off. Set BYPASS_SSO=true in the root .env, run pnpm env:sync, and restart the backend.",
    };
  }
  return {
    success: false,
    message: `${result?.errors ?? `HTTP ${response.status}`} Check the backend log; if the database is behind, apply the migrations (see the README).`,
  };
};

export const logout = async (): Promise<void> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API}auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Couldn't sign out. Please try again.");
};
