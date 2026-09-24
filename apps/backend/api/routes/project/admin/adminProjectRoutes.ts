import express from "express";
import AdminProjectHandler from "api/handlers/project/admin/adminProjectHandler";

const adminProjectRoutes = express.Router();

adminProjectRoutes.get("/dashboard", AdminProjectHandler.getAdminDashboard);
adminProjectRoutes.patch("/disable-toggle", AdminProjectHandler.updateDisableToggle);

export default adminProjectRoutes;