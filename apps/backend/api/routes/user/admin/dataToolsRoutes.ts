import express from "express";
import multer from "multer";
import { currentAdminMiddleware } from "../../../middlewares/currentAdminMiddleware.js";
import { parseSpreadsheet } from "../../../utils/csv/spreadsheetParser.js";
import { importCsvUsers } from "../../../utils/csv/csvUserImport.js";
import { sampleFile } from "../../../utils/demo/sampleFiles.js";
import {
  databaseOverview,
  databaseRows,
} from "../../../utils/demo/databaseExplorer.js";
import {
  getErrorMessage,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../../utils/response/response.js";

const router = express.Router();
router.use(currentAdminMiddleware);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
}).single("file");
router.post(
  "/:type/:action",
  (req, res, next) => {
    if (
      !["student", "staff"].includes(String(req.params.type)) ||
      !["preview", "import"].includes(String(req.params.action))
    )
      return sendErrorResponse(res, "Unknown import action.", 404);
    upload(req, res, (error: unknown) => {
      if (error)
        return sendErrorResponse(
          res,
          error instanceof multer.MulterError &&
            error.code === "LIMIT_FILE_SIZE"
            ? "File exceeds the 5MB limit."
            : "Upload one file in the file field.",
          error instanceof multer.MulterError &&
            error.code === "LIMIT_FILE_SIZE"
            ? 413
            : 400,
        );
      next();
    });
  },
  async (req, res) => {
    if (!req.file)
      return sendErrorResponse(res, "Choose a file to upload.", 400);
    const type = req.params.type === "staff" ? "staff" : "student";
    let validation;
    try {
      validation = await parseSpreadsheet(
        req.file.buffer,
        req.file.originalname,
        type,
      );
      if (!validation.totalRows)
        return sendErrorResponse(res, "File has no data rows.", 400);
    } catch (error) {
      return sendErrorResponse(
        res,
        getErrorMessage(error, "Invalid file."),
        400,
      );
    }
    if (req.params.action === "preview") {
      return sendSuccessResponse(res, {
        totalRows: validation.totalRows,
        validCount: validation.validRows.length,
        failedRows: validation.failedRows,
        rows: validation.validRows
          .slice(0, 10)
          .map((row) => ({
            line: row.row_number,
            ...Object.fromEntries(
              Object.entries(row.data).filter(([key]) => key !== "password"),
            ),
          })),
      });
    }
    try {
      return sendSuccessResponse(res, await importCsvUsers(validation));
    } catch {
      return sendErrorResponse(
        res,
        "Database import failed. Please retry.",
        500,
      );
    }
  },
);

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
