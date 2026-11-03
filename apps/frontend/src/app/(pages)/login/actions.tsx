export const login = async (microsoftToken: string, role?: string) => {
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

    const resultlogin = await responselogin.json();
    console.log(resultlogin);
    if (resultlogin.status) {
      return { success: true, data: resultlogin.data };
    } else {
      return { success: false, message: resultlogin.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
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
