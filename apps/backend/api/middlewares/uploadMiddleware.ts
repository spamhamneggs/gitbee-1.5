import type { RequestHandler } from "express";
import multer from "multer";
import path from "node:path";
import { sendErrorResponse } from "../utils/response/response.js";

class InvalidCsvFileTypeError extends Error {}
class InvalidCsvEncodingError extends Error {}

const invalidCsvEncodingMessage =
  "File must be UTF-8 encoded (in Excel, Save As 'CSV UTF-8')";

const nonCsvFileSignatures = [
  Buffer.from("%PDF-"),
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from("GIF87a"),
  Buffer.from("GIF89a"),
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  Buffer.from("MZ"),
];

const allowedMimeTypes = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "text/plain",
  "application/csv",
  "text/x-csv",
  "application/octet-stream",
]);

const isCsvContent = (buffer: Buffer): boolean => {
  if (
    nonCsvFileSignatures.some((signature) => buffer.subarray(0, signature.length).equals(signature))
  ) {
    return false;
  }

  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new InvalidCsvEncodingError(invalidCsvEncodingMessage);
  }

  for (let index = 0; index < content.length; index += 1) {
    const characterCode = content.charCodeAt(index);
    if (
      characterCode <= 8 ||
      characterCode === 11 ||
      characterCode === 12 ||
      (characterCode >= 14 && characterCode <= 31) ||
      characterCode === 127
    ) {
      return false;
    }
  }

  if (content.startsWith("\uFEFF")) {
    content = content.slice(1);
  }

  let state: "fieldStart" | "unquoted" | "quoted" | "quoteClosed" =
    "fieldStart";

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (state === "quoted") {
      if (character === '"') {
        if (content[index + 1] === '"') {
          index += 1;
        } else {
          state = "quoteClosed";
        }
      }
      continue;
    }

    if (state === "quoteClosed") {
      if (character === "," || character === ";") {
        state = "fieldStart";
      } else if (character === "\r" || character === "\n") {
        state = "fieldStart";
        if (character === "\r" && content[index + 1] === "\n") {
          index += 1;
        }
      } else if (character === " " || character === "\t") {
        // The parser trims whitespace around fields, so allow it between a
        // closing quote and the delimiter (e.g. `; "value" ;`).
        continue;
      } else {
        return false;
      }
      continue;
    }

    if (state === "fieldStart") {
      if (character === " " || character === "\t") {
        // Leading whitespace before a field is trimmed by the parser.
        continue;
      }
      if (character === '"') {
        state = "quoted";
      } else if (character === "," || character === ";") {
        // Empty field (e.g. `a,,b`); stay in fieldStart.
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && content[index + 1] === "\n") {
          index += 1;
        }
      } else {
        state = "unquoted";
      }
      continue;
    }

    // state === "unquoted"
    if (character === '"') {
      return false;
    } else if (character === "," || character === ";") {
      state = "fieldStart";
    } else if (character === "\r" || character === "\n") {
      state = "fieldStart";
      if (character === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
    }
  }

  return state !== "quoted";
};

const uploadSingleCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    const hasCsvExtension =
      path.extname(file.originalname).toLowerCase() === ".csv";
    if (!hasCsvExtension || !allowedMimeTypes.has(file.mimetype)) {
      callback(new InvalidCsvFileTypeError("Only CSV files are allowed."));
      return;
    }

    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

export const uploadCsv: RequestHandler = (req, res, next) => {
  uploadSingleCsv(req, res, (error: unknown) => {
    if (!error) {
      if (req.file && (req.file.size === 0 || req.file.buffer.length === 0)) {
        sendErrorResponse(res, "CSV file cannot be empty", 400);
        return;
      }

      try {
        if (req.file && !isCsvContent(req.file.buffer)) {
          sendErrorResponse(res, "Only CSV files are allowed.", 400);
          return;
        }
      } catch (validationError) {
        if (validationError instanceof InvalidCsvEncodingError) {
          sendErrorResponse(res, validationError.message, 400);
          return;
        }
        next(validationError);
        return;
      }

      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const isFileTooLarge = error.code === "LIMIT_FILE_SIZE";
      sendErrorResponse(
        res,
        isFileTooLarge
          ? "File size exceeds the 5MB limit."
          : error.message,
        isFileTooLarge ? 413 : 400
      );
      return;
    }

    if (error instanceof InvalidCsvFileTypeError) {
      sendErrorResponse(res, error.message, 400);
      return;
    }

    next(error);
  });
};
