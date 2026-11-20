// Must match the backend's COOKIE_NAME; `pnpm env:sync` copies it over.
export const SESSION_COOKIE_NAME =
  process.env.NEXT_PUBLIC_COOKIE_NAME || "gitbee_token";

// Mirrors the backend's BYPASS_SSO gate: opt-in, and never in a production build.
export const SSO_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_BYPASS_SSO === "true" &&
  process.env.NODE_ENV !== "production";

// Shown in dev/test builds; production builds redirect /login to /login/microsoft.
export const LOCAL_LOGIN_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN !== "false";  

const DASHBOARD_BY_ROLE: Record<string, string> = {
  student: "/dashboard",
  lecturer: "/dashboard-lecturer",
  scc: "/dashboard-scc",
  hop: "/dashboard-hop",
  admin: "/dashboard-admin",
};

export const dashboardPathForRole = (role: string | undefined) =>
  role ? DASHBOARD_BY_ROLE[role.toLowerCase()] : undefined;
