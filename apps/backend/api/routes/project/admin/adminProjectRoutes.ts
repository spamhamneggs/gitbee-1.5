import express from "express";
import AdminProjectHandler from "../../../handlers/project/admin/adminProjectHandler.js";

const adminProjectRoutes = express.Router();

adminProjectRoutes.get("/dashboard", AdminProjectHandler.getAdminDashboard);
adminProjectRoutes.patch("/disable-toggle", AdminProjectHandler.updateDisableToggle);

export default adminProjectRoutes;