import express from "express";
import TechnologyHandler from "../../handlers/technology/technologyHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const technologyRoutes = express.Router();

technologyRoutes.use(AuthMiddleware());
technologyRoutes.get("/all", TechnologyHandler.listTechnologies);
technologyRoutes.post("/admin/insert", RoleMiddleware("Admin"), TechnologyHandler.createTechnology);
technologyRoutes.patch("/admin/update", RoleMiddleware("Admin"), TechnologyHandler.updateTechnology);

export default technologyRoutes;
