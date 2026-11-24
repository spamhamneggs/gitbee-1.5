import express from "express";
import ClassHandler from "../../handlers/class/classHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const classRoutes = express.Router();

classRoutes.use(AuthMiddleware());
classRoutes.get("/lecturer/transaction", RoleMiddleware("Lecturer"), ClassHandler.listLecturerClasses);
classRoutes.get("/lecturer/list-course", RoleMiddleware("Lecturer"), ClassHandler.listLecturerCourses);
classRoutes.get("/student/transaction", RoleMiddleware("Student"), ClassHandler.listStudentClasses);
classRoutes.get("/student/list", RoleMiddleware("Student"), ClassHandler.listClassStudents);

export default classRoutes;
