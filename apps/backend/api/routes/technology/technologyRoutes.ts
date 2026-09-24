import express from "express";
import TechnologyHandler from "api/handlers/technology/technologyHandler";
import adminTechnologyRoutes from "./admin/adminTechnologyRoutes";

const technologyRoutes = express.Router();

technologyRoutes.get("/all", TechnologyHandler.getAllTechnology);
technologyRoutes.get("/data", TechnologyHandler.getTechnology);

technologyRoutes.use("/admin", adminTechnologyRoutes);


export default technologyRoutes;