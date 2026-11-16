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

function isMalformedJsonError(error: unknown): boolean {
  return error instanceof SyntaxError && (
    ("type" in error && error.type === "entity.parse.failed")
    || ("status" in error && error.status === 400 && "body" in error)
  );
}

function isPayloadTooLargeError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && (
      ("type" in error && error.type === "entity.too.large")
      || ("status" in error && error.status === 413)
    );
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

  if (isMalformedJsonError(error)) {
    sendErrorResponse(res, "Invalid JSON payload", 400);
    return;
  }

  if (isPayloadTooLargeError(error)) {
    sendErrorResponse(res, "Request payload is too large", 413);
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
