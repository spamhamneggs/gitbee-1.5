import express from "express";
import ProjectHandler from "../../handlers/project/projectHandler.js";
import lecturerProjectRoutes from "./lecturer/lecturerProjectRoutes.js";
import adminProjectRoutes from "./admin/adminProjectRoutes.js";
import studentProjectRoutes from "./student/studentProjectRoutes.js";
import sccProjectRoutes from "./scc/sccProjectRoutes.js";
import hopProjectRoutes from "./hop/hopProjectRoutes.js";

const projectRoutes = express.Router();

projectRoutes.post("/insert", ProjectHandler.insertProject);
projectRoutes.get("/all", ProjectHandler.getAllProject);
projectRoutes.get("/detail", ProjectHandler.getDetailProject);

projectRoutes.use("/hop", hopProjectRoutes);
projectRoutes.use("/scc", sccProjectRoutes);
projectRoutes.use("/lecturer", lecturerProjectRoutes);
projectRoutes.use("/admin", adminProjectRoutes);
projectRoutes.use("/student", studentProjectRoutes);

export default projectRoutes;