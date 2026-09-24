import express from "express";
import StudentGroupHandler from "api/handlers/group/student/studentGroupHandler";

const studentGroupRoutes = express.Router();

studentGroupRoutes.post("/insert", StudentGroupHandler.insertTemporaryGroup);
studentGroupRoutes.get("/current", StudentGroupHandler.getCurrentStudentGroup);

export default studentGroupRoutes;