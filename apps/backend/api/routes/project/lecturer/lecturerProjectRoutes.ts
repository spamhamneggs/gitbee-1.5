import express from "express";
import LecturerProjectHandler from "../../../handlers/project/lecturer/lecturerProjectHandler.js";

const lecturerProjectRoutes = express.Router();

lecturerProjectRoutes.get("/class", LecturerProjectHandler.getAllLecturerClassProject);
lecturerProjectRoutes.get("/all-reviewed", LecturerProjectHandler.getAllLecturerGoodProject);

export default lecturerProjectRoutes;