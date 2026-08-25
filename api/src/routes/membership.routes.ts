import { Router } from "express";
import { z } from "zod";
import { AppError } from "../errors/AppError.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { membershipService } from "../services/membership.service.js";

const router = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const userIdParams = z.object({ userId: z.coerce.number().int().positive() }).strict();
const isoDate = z.string().min(10).transform((value) => new Date(value));

const reportPaymentBody = z.object({
  amountCents: z.coerce.number().int().positive().max(1_000_000).optional(),
  amount_cents: z.coerce.number().int().positive().max(1_000_000).optional(),
  notes: z.string().trim().max(1000).optional(),
  paidAt: isoDate.optional(),
  paid_at: isoDate.optional()
}).strict();

const confirmBody = z.object({
  months: z.coerce.number().int().min(1).max(24).default(1)
}).strict();

router.post("/payments", authenticate, requireRoles("CLIENT"), validate({ body: reportPaymentBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const body = req.body as z.infer<typeof reportPaymentBody>;
  const result = await membershipService.reportPayment(req.auth.userId, {
    amountCents: body.amountCents ?? body.amount_cents,
    notes: body.notes,
    paidAt: body.paidAt ?? body.paid_at
  });
  res.status(201).json(result);
}));

router.get("/payments/pending", authenticate, requireRoles("ADMIN"), asyncHandler(async (_req, res) => {
  const payments = await membershipService.listPendingPayments();
  res.json(payments);
}));

router.post("/payments/:id/confirm", authenticate, requireRoles("ADMIN"), validate({ params: idParams, body: confirmBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as z.infer<typeof idParams>;
  const body = req.body as z.infer<typeof confirmBody>;
  const result = await membershipService.confirmPayment(params.id, req.auth.userId, body);
  res.json(result);
}));

router.post("/users/:userId/renew", authenticate, requireRoles("ADMIN"), validate({ params: userIdParams, body: confirmBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as z.infer<typeof userIdParams>;
  const body = req.body as z.infer<typeof confirmBody>;
  const result = await membershipService.renewUserMembership(params.userId, req.auth.userId, body);
  res.json(result);
}));

export { router as membershipRouter };
