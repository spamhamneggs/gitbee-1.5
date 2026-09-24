import express from "express";
import ReviewedProjectHandler from "api/handlers/reviewedProject/reviewedProjectHandler";
import sccReviewedProjectRoutes from "./scc/sccReviewedProjectRoutes";

const reviewedProjectRoutes = express.Router();

reviewedProjectRoutes.get("/all", ReviewedProjectHandler.getAllReviewedProject);

reviewedProjectRoutes.use("/scc", sccReviewedProjectRoutes);

export default reviewedProjectRoutes;