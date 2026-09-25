import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { uploadFileSizeLimitMb } from "./upload.js";

const publicErrorMessages: Record<string, string> = {
  ATTENDANCE_VALIDATION_CLOSED: "El plazo para validar la asistencia ya ha finalizado.",
  AUTH_REQUIRED: "Debes iniciar sesión para continuar.",
  CANNOT_CANCEL_NO_SHOW: "Una reserva marcada como no asistencia no puede cancelarse.",
  CANNOT_DELETE_SELF: "No puedes eliminar tu propia cuenta.",
  CAPACITY_BELOW_OCCUPANCY: "La capacidad no puede ser inferior a las plazas ya confirmadas.",
  CLASS_ALREADY_STARTED: "La clase ya ha comenzado.",
  CLASS_NOT_FOUND: "No se ha encontrado la clase.",
  CLASS_TYPE_ALREADY_EXISTS: "Ya existe un tipo de actividad con ese nombre.",
  CLASS_TYPE_NOT_FOUND: "No se ha encontrado el tipo de actividad.",
  EMAIL_ALREADY_EXISTS: "El correo electrónico ya está registrado.",
  EMPTY_CLASS_TYPE_UPDATE: "Indica un nombre, una URL de imagen o selecciona un archivo.",
  FIXED_USERS_EXCEED_CAPACITY: "Los alumnos fijos no pueden superar la capacidad de la clase.",
  FORBIDDEN: "No tienes permiso para realizar esta acción.",
  INVALID_CLASS_DATES: "La hora de finalización debe ser posterior a la de inicio.",
  INVALID_CLASS_PAYLOAD: "Completa el título, la capacidad y las fechas de la clase.",
  INVALID_CREDENTIALS: "El correo electrónico o la contraseña no son correctos.",
  INVALID_IMAGE_CONTENT: "El archivo seleccionado no contiene una imagen JPG, PNG o WebP válida.",
  INVALID_IMAGE_TYPE: "Solo se permiten imágenes JPG, PNG o WebP.",
  INVALID_PUSH_TOKEN: "El identificador de notificaciones del dispositivo no es válido.",
  INVALID_TEACHER: "Selecciona un usuario con rol de profesor.",
  INVALID_TOKEN: "La sesión ha caducado. Inicia sesión de nuevo.",
  MEMBERSHIP_NOT_REQUIRED: "Los administradores y profesores no necesitan pagar mensualidad.",
  MEMBERSHIP_REQUIRED: "Necesitas una mensualidad activa para reservar.",
  NOT_FOUND: "No se ha encontrado el recurso solicitado.",
  ONLY_CLIENTS_CAN_RESERVE: "Solo los clientes pueden reservar clases.",
  PAYMENT_ALREADY_REVIEWED: "Este pago ya ha sido revisado.",
  PAYMENT_NOT_FOUND: "No se ha encontrado el aviso de pago.",
  RESERVATION_ALREADY_EXISTS: "Ya tienes una reserva activa para esta clase.",
  RESERVATION_CLOSED: "Las reservas se cierran 30 minutos antes del comienzo.",
  RESERVATION_NOT_CONFIRMED: "Solo las reservas confirmadas pueden validar asistencia.",
  RESERVATION_NOT_FOUND: "No se ha encontrado una reserva activa.",
  TEACHER_NOT_CLASS_OWNER: "Los profesores solo pueden gestionar sus propias clases.",
  TEACHER_REQUIRED: "Selecciona un profesor para crear la clase.",
  USER_NOT_FOUND: "No se ha encontrado el usuario."
};

function publicErrorMessage(code: string, fallback: string) {
  return publicErrorMessages[code] ?? fallback;
}

function validationIssueMessage(issue: ZodError["issues"][number]) {
  switch (issue.code) {
    case "invalid_type":
      return "El tipo de dato no es válido.";
    case "too_small":
      return "El valor no alcanza la longitud o cantidad mínima.";
    case "too_big":
      return "El valor supera la longitud o cantidad máxima.";
    case "invalid_format":
      return issue.format === "email"
        ? "El correo electrónico no tiene un formato válido."
        : "El formato del valor no es válido.";
    case "unrecognized_keys":
      return "La solicitud contiene campos no permitidos.";
    case "custom":
      return issue.message || "El valor indicado no es válido.";
    default:
      return "El valor indicado no es válido.";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "El contenido JSON enviado no es válido."
      }
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: publicErrorMessage(error.code, error.message),
        details: error.details
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Revisa los datos enviados e inténtalo de nuevo.",
        details: error.flatten(validationIssueMessage)
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
            ? `La imagen supera el límite de ${limitMb} MB.`
            : "La imagen supera el límite de tamaño permitido."
          : "No se pudo procesar el archivo subido."
      }
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Se ha producido un error inesperado en el servidor.",
      details: env.NODE_ENV === "production" ? undefined : String(error)
    }
  });
};
