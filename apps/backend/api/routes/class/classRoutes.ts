import express from "express";
import ClassHandler from "../../handlers/class/classHandler.js";

const classRoutes = express.Router();

classRoutes.get("/lecturer/transaction", ClassHandler.listLecturerClasses);
classRoutes.get("/lecturer/list-course", ClassHandler.listLecturerCourses);
classRoutes.get("/student/transaction", ClassHandler.listStudentClasses);
classRoutes.get("/student/list", ClassHandler.listClassStudents);

export default classRoutes;
