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

// Signs in as the backend's local dev account (BYPASS_SSO only).
export const loginDevBypass = async () => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API}auth/login-dev`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const result = await response.json();
    if (result.status) {
      return { success: true, data: result.data };
    } else {
      return { success: false, message: result.errors ?? result.message };
    }
  } catch (error: any) {
    console.error("API call failed:", error.message);
  }
};
