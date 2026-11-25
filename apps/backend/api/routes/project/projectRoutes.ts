import express from "express";
import ProjectHandler from "../../handlers/project/projectHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../middlewares/roleMiddleware.js";

const projectRoutes = express.Router();

// Explore (public)
projectRoutes.get("/all", ProjectHandler.listExploreProjects);
projectRoutes.get("/detail", ProjectHandler.getProject);

projectRoutes.use(AuthMiddleware());

// Student
projectRoutes.post("/insert", RoleMiddleware("Student"), ProjectHandler.submitProject);
projectRoutes.get("/student/history", RoleMiddleware("Student"), ProjectHandler.listStudentClassProjects);
projectRoutes.get("/student/all", RoleMiddleware("Student"), ProjectHandler.listStudentProjects);

// Lecturer
projectRoutes.get("/lecturer/class", RoleMiddleware("Lecturer"), ProjectHandler.listLecturerClassProjects);
projectRoutes.get("/lecturer/all-reviewed", RoleMiddleware("Lecturer"), ProjectHandler.listLecturerGradedProjects);

// SCC, Head of Program and Admin dashboards
projectRoutes.get("/scc/dashboard", RoleMiddleware("SCC"), ProjectHandler.getSccDashboard);
projectRoutes.get("/hop/dashboard", RoleMiddleware("HoP"), ProjectHandler.getHopDashboard);
projectRoutes.get("/admin/dashboard", RoleMiddleware("Admin"), ProjectHandler.getAdminDashboard);
projectRoutes.patch("/admin/disable-toggle", RoleMiddleware("Admin"), ProjectHandler.toggleProjectDisabled);

export default projectRoutes;
