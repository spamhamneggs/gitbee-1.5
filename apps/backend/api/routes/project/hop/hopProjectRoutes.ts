import express from "express";
import HopProjectHandler from "../../../handlers/project/hop/hopProjectHandler.js";

const hopProjectRoutes = express.Router();

hopProjectRoutes.get("/dashboard", HopProjectHandler.getHoPDashboard);

export default hopProjectRoutes;