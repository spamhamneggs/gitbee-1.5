import express from "express";
import SccProjectHandler from "../../../handlers/project/scc/sccProjectHandler.js";

const sccProjectRoutes = express.Router();

sccProjectRoutes.get("/dashboard", SccProjectHandler.getSccDashboard);

export default sccProjectRoutes;