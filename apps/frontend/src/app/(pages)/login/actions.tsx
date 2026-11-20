interface LoginData {
  nim: string;
  Name: string;
  Email: string;
  ActiveRole: string;
  Role: string[];
  MicrosoftToken: string;
}

type LoginResult =
  | { success: true; data: LoginData }
  | { success: false; message: string };

export const loginLocal = async (
  identifier: string,
  password: string
): Promise<LoginResult> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login-local`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ identifier, password }),
      }
    );

    const result = (await response.json().catch(() => null)) as {
      status?: boolean;
      data?: LoginData;
      errors?: string;
      message?: string;
    } | null;

    if (response.ok && result?.status && result.data) {
      return { success: true, data: result.data };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: "Credential login is disabled in production builds.",
      };
    }

    return {
      success: false,
      message:
        result?.errors ??
        result?.message ??
        "Invalid NIM, email, lecturer code, or password.",
    };
  } catch {
    return {
      success: false,
      message: `Couldn't reach the backend at ${process.env.NEXT_PUBLIC_BACKEND_API}. Is it running?`,
    };
  }
};

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
      status?: boolean; data?: LoginData; errors?: string; message?: string;
    };
    if (responselogin.ok && resultlogin.status && resultlogin.data) {
      return { success: true, data: resultlogin.data };
    } else {
      return { success: false, message: resultlogin.errors ?? resultlogin.message ?? "Login failed" };
    }
  } catch {
    return { success: false, message: "Couldn't sign in. Please try again." };
  }
};

// Local passwords and the dev bypass both use the session cookie. Only SSO
// sessions re-post their Microsoft token when choosing another role.
export const switchRole = async (microsoftToken: string, role: string): Promise<LoginResult> => {
  if (microsoftToken) return login(microsoftToken, role);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login-local/role`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      }
    );
    const result = await response.json() as { status?: boolean; data?: LoginData; errors?: string };
    if (response.ok && result.status && result.data) {
      return { success: true, data: result.data };
    }
    return { success: false, message: result.errors ?? "Role switch failed" };
  } catch {
    return { success: false, message: "Couldn't switch roles. Please try again." };
  }
};

// Signs in as the backend's local dev account (BYPASS_SSO only). Failures
// come back with a message meant for the developer looking at the page.
export const loginDevBypass = async () => {
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
  if (result?.status) {
    return { success: true, data: result.data };
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
