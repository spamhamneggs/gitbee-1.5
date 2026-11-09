import express from "express";
import LecturerClassHandler from "../../../handlers/class/lecturer/lecturerClassHandler.js";

const lecturerClassRoutes = express.Router();

lecturerClassRoutes.get("/transaction", LecturerClassHandler.lecturerClassTransaction);
lecturerClassRoutes.get("/list-course", LecturerClassHandler.lecturerListCourse);

export default lecturerClassRoutes;
