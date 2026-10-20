import express from "express";
import OutstandingProjectHandler from "../../handlers/outstandingProject/outstandingProjectHandler.js";
import hopOutstandingProjectRoutes from "./hop/hopOutstandingProjectRoutes.js";

const outstandingProjectRoutes = express.Router();

outstandingProjectRoutes.get("/all", OutstandingProjectHandler.getAllOutstandingProject);

outstandingProjectRoutes.use("/hop", hopOutstandingProjectRoutes);

export default outstandingProjectRoutes;