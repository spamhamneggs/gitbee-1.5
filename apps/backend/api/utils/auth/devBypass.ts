// Local stand-in for Microsoft SSO: POST /auth/login-dev signs in as a real
// dev admin row, so every middleware sees an ordinary local session.
// Opt-in only, and never honoured in a production build.
export const isSsoBypassEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
    env.BYPASS_SSO === "true" && env.NODE_ENV !== "production";

// No password, so this account can't be used through /auth/login-local.
export const DEV_BYPASS_USER = {
    email: "dev-bypass@gitbee.local",
    name: "Developer Admin",
    role: "Admin",
    user_type: "staff",
    lecturer_code: "DEV-BYPASS",
};
