import express from "express";
import OutstandingProjectHandler from "../../handlers/outstandingProject/outstandingProjectHandler.js";

const outstandingProjectRoutes = express.Router();

outstandingProjectRoutes.post("/hop/insert", OutstandingProjectHandler.recordDecision);

export default outstandingProjectRoutes;
