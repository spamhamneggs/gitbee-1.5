import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "../prisma/generated/prisma/client.js";
import { z } from "zod";
import { ServiceError, sendErrorResponse } from "../utils/response/response.js";

export class AppError extends Error {
  readonly isOperational = true;
  readonly details?: unknown;

  constructor(
    readonly statusCode: number,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    if (details !== undefined) this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "Route not found"));
};

function getBodyParserErrorResponse(error: unknown): { status: number; message: string } | null {
  if (typeof error !== "object" || error === null) return null;

  const type = "type" in error && typeof error.type === "string" ? error.type : undefined;
  if (type === "entity.parse.failed"
    || (error instanceof SyntaxError && "status" in error && error.status === 400 && "body" in error)) {
    return { status: 400, message: "Invalid JSON payload" };
  }
  if ("status" in error && error.status === 400 && "body" in error) {
    return { status: 400, message: "Invalid request body" };
  }
  if ("status" in error && error.status === 400
    && "expose" in error && error.expose === true) {
    return { status: 400, message: "Invalid request body" };
  }
  if (type === "entity.too.large" || ("status" in error && error.status === 413)) {
    return { status: 413, message: "Request payload is too large" };
  }
  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    return { status: 415, message: "Unsupported request encoding" };
  }
  if (type === "request.size.invalid" || type === "request.aborted") {
    return { status: 400, message: "Invalid request body" };
  }
  if ("code" in error && (error.code === "Z_DATA_ERROR" || error.code === "Z_BUF_ERROR")) {
    return { status: 400, message: "Invalid request body" };
  }
  if (type === "entity.verify.failed") {
    return { status: 403, message: "Request body verification failed" };
  }

  return null;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    sendErrorResponse(res, error.message, error.statusCode);
    return;
  }

  if (error instanceof ServiceError) {
    sendErrorResponse(res, error.message, error.status);
    return;
  }

  if (error instanceof z.ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "$",
      message: issue.message,
    }));
    sendErrorResponse(res, details, 400);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      sendErrorResponse(res, "A record with these values already exists", 409);
      return;
    }

    if (error.code === "P2025") {
      sendErrorResponse(res, "Record not found", 404);
      return;
    }

    if (error.code === "P2003") {
      sendErrorResponse(res, "Related record conflict", 409);
      return;
    }
  }

  const bodyParserError = getBodyParserErrorResponse(error);
  if (bodyParserError) {
    sendErrorResponse(res, bodyParserError.message, bodyParserError.status);
    return;
  }

  const requestId = randomUUID();
  const stack = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(
    `[${requestId}] Unhandled error for ${req.method} ${req.path}\n${stack}`,
  );
  res.setHeader("X-Request-ID", requestId);
  sendErrorResponse(res, "Internal server error", 500);
};
