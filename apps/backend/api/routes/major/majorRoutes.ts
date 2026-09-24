import express from "express";
import MajorHandler from "api/handlers/major/majorHandler";

const majorRoutes = express.Router();

majorRoutes.get("/all", MajorHandler.getAllMajor);
majorRoutes.post("/insert", MajorHandler.insertMajor);

export default majorRoutes;