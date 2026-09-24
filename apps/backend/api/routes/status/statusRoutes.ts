import express from "express";
import StatusHandler from "api/handlers/status/statusHandler";

const statusRoutes = express.Router();

statusRoutes.get("/all", StatusHandler.getAllStatus);

export default statusRoutes;
