import express from "express";
import AuthHandler from "../../handlers/auth/authHandler.js";

const authRoutes = express.Router();

authRoutes.post("/login", AuthHandler.login);
authRoutes.post("/login-local", AuthHandler.loginLocal);

export default authRoutes;