import express from "express";
import LecturerGroupHandler from "../../../handlers/group/lecturer/lecturerGroupHandler.js";

const lecturerGroupRoutes = express.Router();


lecturerGroupRoutes.patch("/remove", LecturerGroupHandler.removeTemporaryGroup);

export default lecturerGroupRoutes;