import express from "express";
import lecturerClassRoutes from "./lecturer/lecturerClassRoutes.js";
import studentClassRoutes from "./student/studentClassRoutes.js";

const classRoutes = express.Router();

classRoutes.use("/lecturer", lecturerClassRoutes);
classRoutes.use("/student", studentClassRoutes);

export default classRoutes;