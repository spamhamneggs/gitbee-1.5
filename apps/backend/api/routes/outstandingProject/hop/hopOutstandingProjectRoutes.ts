import express from "express";
import HopOutstandingProjectHandler from "../../../handlers/outstandingProject/hop/hopOutstandingProjectHandler.js";

const hopOutstandingProjectRoutes = express.Router();

hopOutstandingProjectRoutes.post("/insert", HopOutstandingProjectHandler.insertOutstandingProject);

export default hopOutstandingProjectRoutes;