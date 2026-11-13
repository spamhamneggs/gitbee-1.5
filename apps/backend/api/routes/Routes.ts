import express from "express";
import assessmentRoutes from "./assessment/assessmentRoutes.js";
import authRoutes from "./auth/authRoutes.js";
import categoryRoutes from "./category/categoryRoutes.js";
import classRoutes from "./class/classRoutes.js";
import groupRoutes from "./group/groupRoutes.js";
import majorRoutes from "./major/majorRoutes.js";
import outstandingProjectRoutes from "./outstandingProject/outstandingProjectRoutes.js";
import projectRoutes from "./project/projectRoutes.js";
import reviewedProjectRoutes from "./reviewedProject/reviewedProjectRoutes.js";
import semesterRoutes from "./semester/semesterRoutes.js";
import technologyRoutes from "./technology/technologyRoutes.js";
import userRoutes from "./user/userRoutes.js";

// One router per resource: routes/<resource>/<resource>Routes.ts maps each
// path to handlers/<resource>/<resource>Handler.ts, which validates the request
// and calls services/<resource>/ for the database work.
export const resourceRoutes = {
  "/assessment": assessmentRoutes,
  "/auth": authRoutes,
  "/category": categoryRoutes,
  "/class": classRoutes,
  "/group": groupRoutes,
  "/major": majorRoutes,
  "/outstanding-project": outstandingProjectRoutes,
  "/project": projectRoutes,
  "/reviewed-project": reviewedProjectRoutes,
  "/semester": semesterRoutes,
  "/technology": technologyRoutes,
  "/user": userRoutes,
} satisfies Record<string, express.Router>;

const routes = express.Router();

routes.get("/", (req, res) => {
  res.send("Welcome to GitBee");
});

for (const [prefix, router] of Object.entries(resourceRoutes)) {
  routes.use(prefix, router);
}

export default routes;
