import express from "express";
import CategoryHandler from "api/handlers/category/categoryHandler";
import adminCategoryRoutes from "./admin/adminCategoryRoutes";

const categoryRoutes = express.Router();

categoryRoutes.get("/all", CategoryHandler.getAllCategory);

categoryRoutes.use("/admin", adminCategoryRoutes);

export default categoryRoutes;
