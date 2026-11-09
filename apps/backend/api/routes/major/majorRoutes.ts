import express from "express";
import MajorHandler from "../../handlers/major/majorHandler.js";

const majorRoutes = express.Router();

majorRoutes.get("/all", MajorHandler.getAllMajor);

export default majorRoutes;