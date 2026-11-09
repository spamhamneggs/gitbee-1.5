import express from "express";
import adminUserRoutes from "./admin/adminUserRoutes.js";

const userRoutes = express.Router();

userRoutes.use("/admin", adminUserRoutes);

export default userRoutes;
