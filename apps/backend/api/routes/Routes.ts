import express from "express";
import authRoutes from "./auth/authRoutes.js";
import semesterRoutes from "./semester/semesterRoutes.js";
import projectRoutes from "./project/projectRoutes.js";
import statusRoutes from "./status/statusRoutes.js";
import categoryRoutes from "./category/categoryRoutes.js";
import technologyRoutes from "./technology/technologyRoutes.js";
import majorRoutes from "./major/majorRoutes.js";
import userRoutes from "./user/userRoutes.js";
import groupRoutes from "./group/groupRoutes.js";
import assessmentRoutes from "./assessment/assessmentRoutes.js";
import classRoutes from "./class/classRoutes.js";
import reviewedProjectRoutes from "./reviewedProject/reviewedProjectRoutes.js";
import outstandingProjectRoutes from "./outstandingProject/outstandingProjectRoutes.js";
import deadlineRoutes from "./deadline/deadlineRoutes.js";

const routes = express.Router();

routes.use((req, res, next) => {
  next();
});
routes.get("/", (req, res) => {
  res.send("Welcome to GitBee");
});

routes.use("/auth", authRoutes);
routes.use("/user", userRoutes);
routes.use("/semester", semesterRoutes);
routes.use("/class", classRoutes);
routes.use("/reviewed-project", reviewedProjectRoutes);
routes.use("/outstanding-project", outstandingProjectRoutes);
routes.use("/project", projectRoutes);
routes.use("/status", statusRoutes);
routes.use("/category", categoryRoutes);
routes.use("/technology", technologyRoutes);
routes.use("/major", majorRoutes);
routes.use("/group", groupRoutes);
routes.use("/assessment", assessmentRoutes);
routes.use("/deadline", deadlineRoutes);

export default routes;
