import express from "express";
import StudentProjectHandler from "../../../handlers/project/student/studentProjectHandler.js";

const studentProjectRoutes = express.Router();

studentProjectRoutes.get("/history", StudentProjectHandler.getStudentClassProject);
studentProjectRoutes.get("/all", StudentProjectHandler.getAllStudentProfileProject);

export default studentProjectRoutes;