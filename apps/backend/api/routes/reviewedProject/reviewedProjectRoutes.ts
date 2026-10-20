import express from "express";
import ReviewedProjectHandler from "../../handlers/reviewedProject/reviewedProjectHandler.js";
import sccReviewedProjectRoutes from "./scc/sccReviewedProjectRoutes.js";

const reviewedProjectRoutes = express.Router();

reviewedProjectRoutes.get("/all", ReviewedProjectHandler.getAllReviewedProject);

reviewedProjectRoutes.use("/scc", sccReviewedProjectRoutes);

export default reviewedProjectRoutes;