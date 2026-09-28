import express from "express";
import StudentGroupHandler from "../../../handlers/group/student/studentGroupHandler.js";

const studentGroupRoutes = express.Router();

studentGroupRoutes.post("/insert", StudentGroupHandler.insertTemporaryGroup);
studentGroupRoutes.get("/current", StudentGroupHandler.getCurrentStudentGroup);

export default studentGroupRoutes;