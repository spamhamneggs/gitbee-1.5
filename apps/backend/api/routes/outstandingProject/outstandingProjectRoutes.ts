import express from "express";
import OutstandingProjectHandler from "../../handlers/outstandingProject/outstandingProjectHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const outstandingProjectRoutes = express.Router();

outstandingProjectRoutes.use(AuthMiddleware());
outstandingProjectRoutes.post("/hop/insert", RoleMiddleware("HoP"), OutstandingProjectHandler.recordDecision);

export default outstandingProjectRoutes;
