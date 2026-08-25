import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors/AppError.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { reservationService } from "../services/reservation.service.js";

const router = Router();

const classParams = z.object({
  classId: z.coerce.number().int().positive()
}).strict();

const cancelParams = z.object({
  classId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive()
}).strict();

type ClassParams = z.infer<typeof classParams>;
type CancelParams = z.infer<typeof cancelParams>;

router.post("/:classId/reservations", authenticate, validate({ params: classParams }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as ClassParams;
  const result = await reservationService.reserveClass(req.auth.userId, params.classId);
  res.status(201).json(result);
}));

router.delete("/:classId/reservations/:userId", authenticate, validate({ params: cancelParams }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as CancelParams;
  const result = await reservationService.cancelReservationAndPromote({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetUserId: params.userId,
    classId: params.classId
  });
  res.json(result);
}));

router.post("/:classId/attendance/validate", authenticate, validate({ params: classParams }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as ClassParams;
  const reservation = await reservationService.validateAttendance(req.auth.userId, params.classId);
  res.json({ reservation });
}));

export { router as reservationRouter };
