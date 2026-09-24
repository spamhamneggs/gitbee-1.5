import express from "express";
import AdminCategoryHandler from "api/handlers/category/admin/adminCategoryHandler";

const adminCategoryRoutes = express.Router();

adminCategoryRoutes.post("/insert", AdminCategoryHandler.insertCategory);
adminCategoryRoutes.patch("/update", AdminCategoryHandler.updateCategory);

export default adminCategoryRoutes;