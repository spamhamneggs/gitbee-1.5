import express from "express";
import TechnologyHandler from "../../handlers/technology/technologyHandler.js";
import adminTechnologyRoutes from "./admin/adminTechnologyRoutes.js";

const technologyRoutes = express.Router();

technologyRoutes.get("/all", TechnologyHandler.getAllTechnology);
technologyRoutes.get("/data", TechnologyHandler.getTechnology);

technologyRoutes.use("/admin", adminTechnologyRoutes);


export default technologyRoutes;