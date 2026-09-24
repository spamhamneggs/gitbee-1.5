import express from "express";
import OutstandingProjectHandler from "api/handlers/outstandingProject/outstandingProjectHandler";
import hopOutstandingProjectRoutes from "./hop/hopOutstandingProjectRoutes";

const outstandingProjectRoutes = express.Router();

outstandingProjectRoutes.get("/all", OutstandingProjectHandler.getAllOutstandingProject);

outstandingProjectRoutes.use("/hop", hopOutstandingProjectRoutes);

export default outstandingProjectRoutes;