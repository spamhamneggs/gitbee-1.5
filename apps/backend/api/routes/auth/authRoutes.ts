import express from "express";
import AuthHandler from "../../handlers/auth/authHandler.js";
import { createLoginRateLimitMiddleware } from "../../middlewares/loginRateLimitMiddleware.js";
import { localSessionMiddleware } from "../../middlewares/localSessionMiddleware.js";

const authRoutes = express.Router();

authRoutes.post("/login", AuthHandler.login);
authRoutes.post("/login-local", createLoginRateLimitMiddleware({}, AuthHandler.loginLocal));
authRoutes.post("/login-local/role", localSessionMiddleware, AuthHandler.changeLocalRole);
authRoutes.post("/change-password", localSessionMiddleware, createLoginRateLimitMiddleware({
    accountKey: (_req, res) => String(res.locals.localUserId),
}, AuthHandler.changePassword));

export default authRoutes;
