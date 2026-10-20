import express from "express";
import StatusHandler from "../../handlers/status/statusHandler.js";

const statusRoutes = express.Router();

statusRoutes.get("/all", StatusHandler.getAllStatus);

export default statusRoutes;
