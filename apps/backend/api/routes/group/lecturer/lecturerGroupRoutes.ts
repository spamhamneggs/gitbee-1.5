import express from "express";
import LecturerGroupHandler from "api/handlers/group/lecturer/lecturerGroupHandler";

const lecturerGroupRoutes = express.Router();

lecturerGroupRoutes.get("/class-group", LecturerGroupHandler.getClassGroup);
lecturerGroupRoutes.get("/class-list", LecturerGroupHandler.getClassList);

lecturerGroupRoutes.patch("/remove", LecturerGroupHandler.removeTemporaryGroup);

export default lecturerGroupRoutes;