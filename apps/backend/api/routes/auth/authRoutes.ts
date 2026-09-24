import express from "express";
import AuthHandler from "api/handlers/auth/authHandler";

const authRoutes = express.Router();

authRoutes.post("/login", AuthHandler.login);

export default authRoutes;