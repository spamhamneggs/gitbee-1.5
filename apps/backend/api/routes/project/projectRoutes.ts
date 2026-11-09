import express from "express";
import ProjectHandler from "../../handlers/project/projectHandler.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const projectRoutes = express.Router();

// Explore (public)
projectRoutes.get("/all", ProjectHandler.listExploreProjects);
projectRoutes.get("/detail", ProjectHandler.getProject);

// Student
projectRoutes.post("/insert", RoleMiddleware("Student"), ProjectHandler.submitProject);
projectRoutes.get("/student/history", ProjectHandler.listStudentClassProjects);
projectRoutes.get("/student/all", ProjectHandler.listStudentProjects);

// Lecturer
projectRoutes.get("/lecturer/class", ProjectHandler.listLecturerClassProjects);
projectRoutes.get("/lecturer/all-reviewed", ProjectHandler.listLecturerGradedProjects);

// SCC, Head of Program and Admin dashboards
projectRoutes.get("/scc/dashboard", ProjectHandler.getSccDashboard);
projectRoutes.get("/hop/dashboard", ProjectHandler.getHopDashboard);
projectRoutes.get("/admin/dashboard", ProjectHandler.getAdminDashboard);
projectRoutes.patch("/admin/disable-toggle", ProjectHandler.toggleProjectDisabled);

export default projectRoutes;
