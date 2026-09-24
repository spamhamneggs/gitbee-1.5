import DeadlineHandler from "api/handlers/deadline/deadlineHandler";
import express from "express";

const deadlineRoutes = express.Router();

deadlineRoutes.get("/check", DeadlineHandler.checkDeadline);

export default deadlineRoutes;