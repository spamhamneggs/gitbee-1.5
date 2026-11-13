import express from "express";
import TechnologyHandler from "../../handlers/technology/technologyHandler.js";

const technologyRoutes = express.Router();

technologyRoutes.get("/all", TechnologyHandler.listTechnologies);
technologyRoutes.post("/admin/insert", TechnologyHandler.createTechnology);
technologyRoutes.patch("/admin/update", TechnologyHandler.updateTechnology);

export default technologyRoutes;
