import express from "express";
import MajorHandler from "../../handlers/major/majorHandler.js";
import { AuthMiddleware } from "../../middlewares/authMiddleware.js";

const majorRoutes = express.Router();

majorRoutes.use(AuthMiddleware());
majorRoutes.get("/all", MajorHandler.listMajors);

export default majorRoutes;
