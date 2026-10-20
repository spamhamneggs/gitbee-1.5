import express from "express";
import AssessmentHandler from "../../handlers/assessment/assessmentHandler.js";

const assessmentRoutes = express.Router();

assessmentRoutes.post("/insert", AssessmentHandler.insertAssessment);

export default assessmentRoutes;