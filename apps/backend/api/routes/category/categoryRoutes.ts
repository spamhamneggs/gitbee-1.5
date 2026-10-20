import express from "express";
import CategoryHandler from "../../handlers/category/categoryHandler.js";
import adminCategoryRoutes from "./admin/adminCategoryRoutes.js";

const categoryRoutes = express.Router();

categoryRoutes.get("/all", CategoryHandler.getAllCategory);

categoryRoutes.use("/admin", adminCategoryRoutes);

export default categoryRoutes;
