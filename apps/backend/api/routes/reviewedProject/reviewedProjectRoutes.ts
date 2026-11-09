import express from "express";
import ReviewedProjectHandler from "../../handlers/reviewedProject/reviewedProjectHandler.js";

const reviewedProjectRoutes = express.Router();

reviewedProjectRoutes.post("/scc/insert", ReviewedProjectHandler.recordReview);

export default reviewedProjectRoutes;
