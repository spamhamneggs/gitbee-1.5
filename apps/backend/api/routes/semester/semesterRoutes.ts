import express from "express";
import SemesterHandler from "../../handlers/semester/semesterHandler.js";

const semesterRoutes = express.Router();

semesterRoutes.get("/all", SemesterHandler.listSemesters);
semesterRoutes.get("/current", SemesterHandler.getCurrentSemester);

export default semesterRoutes;
