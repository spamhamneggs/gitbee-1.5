import express from "express";
import CategoryHandler from "../../handlers/category/categoryHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const categoryRoutes = express.Router();

categoryRoutes.use(AuthMiddleware());
categoryRoutes.get("/all", CategoryHandler.listCategories);
categoryRoutes.post("/admin/insert", RoleMiddleware("Admin"), CategoryHandler.createCategory);
categoryRoutes.patch("/admin/update", RoleMiddleware("Admin"), CategoryHandler.updateCategory);

export default categoryRoutes;
