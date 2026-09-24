import express from "express";
import SccReviewedProjectHandler from "api/handlers/reviewedProject/scc/sccReviewedPorjectHandler";

const sccReviewedProjectRoutes = express.Router();

sccReviewedProjectRoutes.post("/insert", SccReviewedProjectHandler.insertReviewedProject);

export default sccReviewedProjectRoutes;