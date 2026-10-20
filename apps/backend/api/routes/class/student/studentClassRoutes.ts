import express from "express";
import StudentClassHandler from "../../../handlers/class/student/studentClassHandler.js";

const studentClassRoutes = express.Router();

studentClassRoutes.get("/transaction", StudentClassHandler.studentClassTransaction);
studentClassRoutes.get("/list", StudentClassHandler.studentListInClass);

export default studentClassRoutes;
