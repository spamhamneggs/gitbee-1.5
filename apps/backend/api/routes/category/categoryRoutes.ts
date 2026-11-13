import express from "express";
import CategoryHandler from "../../handlers/category/categoryHandler.js";

const categoryRoutes = express.Router();

categoryRoutes.get("/all", CategoryHandler.listCategories);
categoryRoutes.post("/admin/insert", CategoryHandler.createCategory);
categoryRoutes.patch("/admin/update", CategoryHandler.updateCategory);

export default categoryRoutes;
