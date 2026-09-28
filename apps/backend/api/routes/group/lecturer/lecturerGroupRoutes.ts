import express from "express";
import LecturerGroupHandler from "../../../handlers/group/lecturer/lecturerGroupHandler.js";

const lecturerGroupRoutes = express.Router();

lecturerGroupRoutes.get("/class-group", LecturerGroupHandler.getClassGroup);
lecturerGroupRoutes.get("/class-list", LecturerGroupHandler.getClassList);

lecturerGroupRoutes.patch("/remove", LecturerGroupHandler.removeTemporaryGroup);

export default lecturerGroupRoutes;