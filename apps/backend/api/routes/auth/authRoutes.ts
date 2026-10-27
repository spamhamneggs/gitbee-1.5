import express from "express";
import AuthHandler from "../../handlers/auth/authHandler.js";
import { loginRateLimitMiddleware } from "../../middlewares/loginRateLimitMiddleware.js";

const authRoutes = express.Router();

authRoutes.post("/login", AuthHandler.login);
authRoutes.post("/login-local", loginRateLimitMiddleware, AuthHandler.loginLocal);
authRoutes.post("/change-password", AuthHandler.changePassword);

export default authRoutes;