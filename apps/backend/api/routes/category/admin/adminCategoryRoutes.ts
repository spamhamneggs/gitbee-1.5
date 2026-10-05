import express from "express";
import AdminCategoryHandler from "../../../handlers/category/admin/adminCategoryHandler.js";

const adminCategoryRoutes = express.Router();

adminCategoryRoutes.post("/insert", AdminCategoryHandler.insertCategory);
adminCategoryRoutes.patch("/update", AdminCategoryHandler.updateCategory);

export default adminCategoryRoutes;