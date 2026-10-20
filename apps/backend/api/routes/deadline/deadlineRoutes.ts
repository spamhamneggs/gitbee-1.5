import DeadlineHandler from "../../handlers/deadline/deadlineHandler.js";
import express from "express";

const deadlineRoutes = express.Router();

deadlineRoutes.get("/check", DeadlineHandler.checkDeadline);

export default deadlineRoutes;