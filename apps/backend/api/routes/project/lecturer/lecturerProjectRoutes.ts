import express from "express";
import LecturerProjectHandler from "api/handlers/project/lecturer/lecturerProjectHandler";

const lecturerProjectRoutes = express.Router();

lecturerProjectRoutes.get("/class", LecturerProjectHandler.getAllLecturerClassProject);
lecturerProjectRoutes.get("/all-reviewed", LecturerProjectHandler.getAllLecturerGoodProject);

export default lecturerProjectRoutes;