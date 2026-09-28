import express from "express";
import AdminTechnologyHandler from "../../../handlers/technology/admin/adminTechnologyHandler.js";

const adminTechnologyRoutes = express.Router();

adminTechnologyRoutes.post("/insert", AdminTechnologyHandler.insertTechnology);
adminTechnologyRoutes.patch("/update", AdminTechnologyHandler.updateTechnology);

export default adminTechnologyRoutes;