import express from "express";
import GroupHandler from "../../handlers/group/groupHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const groupRoutes = express.Router();

groupRoutes.use(AuthMiddleware());
groupRoutes.post("/student/insert", RoleMiddleware("Student"), GroupHandler.createGroup);
groupRoutes.get("/student/current", RoleMiddleware("Student"), GroupHandler.getStudentGroup);
groupRoutes.patch("/lecturer/remove", RoleMiddleware("Lecturer"), GroupHandler.deleteGroup);

export default groupRoutes;
