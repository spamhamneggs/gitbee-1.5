import express from "express";
import HopOutstandingProjectHandler from "api/handlers/outstandingProject/hop/hopOutstandingProjectHandler";

const hopOutstandingProjectRoutes = express.Router();

hopOutstandingProjectRoutes.post("/insert", HopOutstandingProjectHandler.insertOutstandingProject);

export default hopOutstandingProjectRoutes;