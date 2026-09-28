import express from "express";
import SccReviewedProjectHandler from "../../../handlers/reviewedProject/scc/sccReviewedPorjectHandler.js";

const sccReviewedProjectRoutes = express.Router();

sccReviewedProjectRoutes.post("/insert", SccReviewedProjectHandler.insertReviewedProject);

export default sccReviewedProjectRoutes;