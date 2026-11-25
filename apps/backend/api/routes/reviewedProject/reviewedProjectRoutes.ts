import express from "express";
import ReviewedProjectHandler from "../../handlers/reviewedProject/reviewedProjectHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const reviewedProjectRoutes = express.Router();

reviewedProjectRoutes.use(AuthMiddleware());
reviewedProjectRoutes.post("/scc/insert", RoleMiddleware("SCC"), ReviewedProjectHandler.recordReview);

export default reviewedProjectRoutes;
