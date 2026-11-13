import express from "express";
import GroupHandler from "../../handlers/group/groupHandler.js";

const groupRoutes = express.Router();

groupRoutes.post("/student/insert", GroupHandler.createGroup);
groupRoutes.get("/student/current", GroupHandler.getStudentGroup);
groupRoutes.patch("/lecturer/remove", GroupHandler.deleteGroup);

export default groupRoutes;
