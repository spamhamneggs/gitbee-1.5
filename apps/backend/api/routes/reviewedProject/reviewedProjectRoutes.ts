import express from "express";
import sccReviewedProjectRoutes from "./scc/sccReviewedProjectRoutes.js";

const reviewedProjectRoutes = express.Router();


reviewedProjectRoutes.use("/scc", sccReviewedProjectRoutes);

export default reviewedProjectRoutes;