import express from "express";
import UserHandler from "../../handlers/user/userHandler.js";
import adminUserRoutes from "./admin/adminUserRoutes.js";

const userRoutes = express.Router();

userRoutes.get("/get-name", UserHandler.getName);
userRoutes.get("/get-role", UserHandler.getAllRole);

userRoutes.use("/admin", adminUserRoutes);

export default userRoutes;
