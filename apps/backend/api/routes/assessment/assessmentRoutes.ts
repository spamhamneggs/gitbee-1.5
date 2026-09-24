import express from "express";
import AssessmentHandler from "api/handlers/assessment/assessmentHandler";

const assessmentRoutes = express.Router();

assessmentRoutes.post("/insert", AssessmentHandler.insertAssessment);

export default assessmentRoutes;