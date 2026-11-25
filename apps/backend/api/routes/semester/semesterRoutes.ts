import express from "express";
import SemesterHandler from "../../handlers/semester/semesterHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";

const semesterRoutes = express.Router();

semesterRoutes.use(AuthMiddleware());
semesterRoutes.get("/all", SemesterHandler.listSemesters);
semesterRoutes.get("/current", SemesterHandler.getCurrentSemester);

export default semesterRoutes;
