import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors/AppError.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
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
const reserveBody = z.preprocess(
  (value) => value ?? {},
  z.object({
    hideName: z.boolean().optional(),
    hide_name: z.boolean().optional(),
    ocultar_nombre: z.boolean().optional()
  }).strict()
);
const privacyBody = z.object({ hideName: z.boolean() }).strict();

type ClassParams = z.infer<typeof classParams>;
type CancelParams = z.infer<typeof cancelParams>;

router.post("/:classId/reservations", authenticate, requireRoles("CLIENT"), validate({ params: classParams, body: reserveBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as ClassParams;
  const body = req.body as z.infer<typeof reserveBody>;
  const hideName = body.hideName ?? body.hide_name ?? body.ocultar_nombre ?? false;
  const result = await reservationService.reserveClass(req.auth.userId, params.classId, new Date(), hideName);
  res.status(201).json(result);
}));

router.patch("/:classId/reservations/privacy", authenticate, requireRoles("CLIENT"), validate({ params: classParams, body: privacyBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as ClassParams;
  const body = req.body as z.infer<typeof privacyBody>;
  const reservation = await reservationService.setReservationPrivacy(req.auth.userId, params.classId, body.hideName);
  res.json({ reservation });
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
