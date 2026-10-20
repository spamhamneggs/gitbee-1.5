import express from "express";
import studentGroupRoutes from "./student/studentGroupRoutes.js";
import lecturerGroupRoutes from "./lecturer/lecturerGroupRoutes.js";

const groupRoutes = express.Router();

groupRoutes.use("/student", studentGroupRoutes);
groupRoutes.use("/lecturer", lecturerGroupRoutes);

export default groupRoutes;