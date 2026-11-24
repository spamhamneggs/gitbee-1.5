import express from "express";
import AssessmentHandler from "../../handlers/assessment/assessmentHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const assessmentRoutes = express.Router();

assessmentRoutes.use(AuthMiddleware());
assessmentRoutes.post("/insert", RoleMiddleware("Lecturer"), AssessmentHandler.gradeClass);

export default assessmentRoutes;
