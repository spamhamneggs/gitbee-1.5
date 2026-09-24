import express from "express";
import UserHandler from "api/handlers/user/userHandler";
import adminUserRoutes from "./admin/adminUserRoutes";

const userRoutes = express.Router();

userRoutes.get("/get-name", UserHandler.getName);
userRoutes.get("/get-role", UserHandler.getAllRole);

userRoutes.use("/admin", adminUserRoutes);

export default userRoutes;
