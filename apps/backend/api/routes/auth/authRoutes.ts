import express from "express";
import AuthHandler from "../../handlers/auth/authHandler.js";
import { createLoginRateLimitMiddleware } from "../../middlewares/loginRateLimitMiddleware.js";
import { localSessionMiddleware } from "../../middlewares/localSessionMiddleware.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";

const authRoutes = express.Router();

authRoutes.get("/session", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
}, AuthMiddleware(), AuthHandler.session);
authRoutes.post("/session/role", AuthMiddleware(), AuthHandler.changeSessionRole);
authRoutes.post("/logout", AuthHandler.logout);

authRoutes.post("/login", AuthHandler.login);
authRoutes.post("/login-dev", AuthHandler.loginDevBypass);
authRoutes.post("/login-local", createLoginRateLimitMiddleware({}, AuthHandler.loginLocal));
authRoutes.post("/login-local/role", localSessionMiddleware, AuthHandler.changeLocalRole);
authRoutes.post("/change-password", localSessionMiddleware, createLoginRateLimitMiddleware({
    accountKey: (_req, res) => String(res.locals.localUserId),
}, AuthHandler.changePassword));

export default authRoutes;
