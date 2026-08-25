import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { uploadFileSizeLimitMb } from "./upload.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON payload"
      }
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const limitMb = uploadFileSizeLimitMb(error.field);
    res.status(400).json({
      error: {
        code: error.code === "LIMIT_FILE_SIZE" ? "IMAGE_TOO_LARGE" : "UPLOAD_ERROR",
        message: error.code === "LIMIT_FILE_SIZE"
          ? limitMb
            ? `Image exceeds the ${limitMb} MB limit`
            : "Image exceeds the configured upload limit"
          : error.message
      }
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
      details: env.NODE_ENV === "production" ? undefined : String(error)
    }
  });
};
