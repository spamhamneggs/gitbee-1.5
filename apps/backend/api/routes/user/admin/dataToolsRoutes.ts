import express from "express";
import { AuthMiddleware } from "../../../middlewares/authMiddleware.js";
import { RoleMiddleware } from "../../../middlewares/roleMiddleware.js";
import { currentAdminMiddleware } from "../../../middlewares/currentAdminMiddleware.js";
import { sampleFile } from "../../../utils/demo/sampleFiles.js";
import {
  DemoInputError,
  validateDemoData,
  previewDemoData,
  logDemoReceipt,
  saveDemoData,
} from "../../../utils/demo/saveDemoData.js";
import {
  databaseOverview,
  databaseRows,
} from "../../../utils/demo/databaseExplorer.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../../utils/response/response.js";

const router = express.Router();
router.use(AuthMiddleware(), RoleMiddleware("Admin"), currentAdminMiddleware);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
for (const action of ["preview", "save"] as const) {
  router.post("/imports/" + action, async (req, res) => {
    if (!req.is("application/json"))
      return sendErrorResponse(res, "Send application/json.", 415);
    try {
      const files = validateDemoData(req.body);
      logDemoReceipt(files, action);
      return sendSuccessResponse(
        res,
        action === "preview"
          ? previewDemoData(files)
          : await saveDemoData(files),
      );
    } catch (error) {
      return sendErrorResponse(
        res,
        error instanceof DemoInputError
          ? error.message
          : "Database import failed. Please retry.",
        error instanceof DemoInputError ? 400 : 500,
      );
    }
  });
}

router.get("/samples/:type/:format", (req, res) => {
  if (
    !["student", "staff"].includes(String(req.params.type)) ||
    !["csv", "xlsx"].includes(String(req.params.format))
  )
    return sendErrorResponse(res, "Unknown sample.", 404);
  const type = req.params.type === "staff" ? "staff" : "student";
  const format = req.params.format === "xlsx" ? "xlsx" : "csv";
  res.type(
    format === "csv"
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.attachment(
    `${type}${req.query.errors === "true" ? "-with-errors" : "-sample"}.${format}`,
  );
  res.send(sampleFile(type, format, req.query.errors === "true"));
});
router.get("/database", async (_req, res) => {
  try {
    sendSuccessResponse(res, {
      engine: "MySQL / MariaDB",
      tables: await databaseOverview(),
    });
  } catch {
    sendErrorResponse(
      res,
      "Database unavailable. Check the connection and migrations.",
      503,
    );
  }
});
router.get("/database/:table", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return sendErrorResponse(res, "Invalid page.", 400);
  try {
    const rows = await databaseRows(String(req.params.table), page);
    if (!rows) return sendErrorResponse(res, "Unknown table.", 404);
    sendSuccessResponse(res, { rows, page, pageSize: 20 });
  } catch {
    sendErrorResponse(res, "Could not read this table.", 503);
  }
});

export default router;
