import express from "express";
import ProjectHandler from "api/handlers/project/projectHandler";
import lecturerProjectRoutes from "./lecturer/lecturerProjectRoutes";
import adminProjectRoutes from "./admin/adminProjectRoutes";
import studentProjectRoutes from "./student/studentProjectRoutes";
import sccProjectRoutes from "./scc/sccProjectRoutes";
import hopProjectRoutes from "./hop/hopProjectRoutes";

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