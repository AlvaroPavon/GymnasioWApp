import bcrypt from "bcryptjs";
import { addMonths, isAfter } from "date-fns";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadProfile, publicUploadUrl } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { env } from "../config/env.js";
import { userDto } from "../utils/dto.js";

const router = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const isoOrLocalDate = z.string().min(10).transform((value) => new Date(value));

const createUserBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(191),
  password: z.string().min(8).max(128),
  role: z.enum(["ADMIN", "TEACHER", "CLIENT"]).default("CLIENT"),
  monthlyStatus: z.enum(["PAGADO", "IMPAGADO"]).optional(),
  estado_mensualidad: z.enum(["PAGADO", "IMPAGADO"]).optional(),
  membershipExpiresAt: isoOrLocalDate.optional(),
  membership_expires_at: isoOrLocalDate.optional(),
  phone: z.string().trim().max(30).optional(),
  profilePicture: z.string().url().optional(),
  profile_picture: z.string().url().optional()
}).strict();

const updateUserBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().max(191).optional(),
  role: z.enum(["ADMIN", "TEACHER", "CLIENT"]).optional(),
  monthlyStatus: z.enum(["PAGADO", "IMPAGADO"]).optional(),
  estado_mensualidad: z.enum(["PAGADO", "IMPAGADO"]).optional(),
  membershipExpiresAt: isoOrLocalDate.optional(),
  membership_expires_at: isoOrLocalDate.optional(),
  phone: z.string().trim().max(30).optional(),
  profilePicture: z.string().url().optional(),
  profile_picture: z.string().url().optional()
}).passthrough();

const resetPasswordBody = z.object({
  password: z.string().min(8).max(128)
}).strict();

/**
 * Hashes a user password with the configured bcrypt cost.
 * This keeps admin password resets aligned with secure account creation.
 */
async function hashUserPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_COST);
}

async function assertEmailAvailable(email: string | undefined, currentUserId?: number) {
  if (!email) return;
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
  if (existing && existing.id !== currentUserId) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");
  }
}

function normalizeMembership(input: {
  role: "ADMIN" | "TEACHER" | "CLIENT";
  monthlyStatus?: "PAGADO" | "IMPAGADO";
  estado_mensualidad?: "PAGADO" | "IMPAGADO";
  membershipExpiresAt?: Date;
  membership_expires_at?: Date;
}, current?: { monthlyStatus: "PAGADO" | "IMPAGADO"; membershipExpiresAt: Date | null }) {
  if (input.role !== "CLIENT") {
    return { monthlyStatus: "PAGADO" as const, membershipExpiresAt: null };
  }

  const requestedStatus = input.monthlyStatus ?? input.estado_mensualidad ?? current?.monthlyStatus ?? "IMPAGADO";
  const requestedExpiry = input.membershipExpiresAt ?? input.membership_expires_at ?? current?.membershipExpiresAt ?? null;
  if (requestedStatus === "IMPAGADO") {
    return { monthlyStatus: "IMPAGADO" as const, membershipExpiresAt: requestedExpiry };
  }

  const membershipExpiresAt = requestedExpiry && isAfter(requestedExpiry, new Date())
    ? requestedExpiry
    : addMonths(new Date(), 1);

  return { monthlyStatus: "PAGADO" as const, membershipExpiresAt };
}

router.get("/", authenticate, requireRoles("ADMIN"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  res.json(users.map(userDto));
}));

router.post("/", authenticate, requireRoles("ADMIN"), uploadProfile.single("profile"), asyncHandler(async (req, res) => {
  const body = createUserBody.parse(req.body);
  const email = body.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");

  const profilePicture = publicUploadUrl(req.file) ?? body.profilePicture ?? body.profile_picture;
  const membership = normalizeMembership(body);
  const user = await prisma.user.create({
    data: {
      name: body.name.trim(),
      email,
      passwordHash: await hashUserPassword(body.password),
      role: body.role,
      monthlyStatus: membership.monthlyStatus,
      membershipExpiresAt: membership.membershipExpiresAt,
      phone: body.phone,
      profilePicture
    }
  });

  res.status(201).json(userDto(user));
}));

router.put("/profile", authenticate, uploadProfile.single("profile"), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const body = updateUserBody.parse(req.body);
  await assertEmailAvailable(body.email, req.auth.userId);
  const profilePicture = publicUploadUrl(req.file) ?? body.profilePicture ?? body.profile_picture;
  const user = await prisma.user.update({
    where: { id: req.auth.userId },
    data: {
      name: body.name,
      email: body.email?.toLowerCase().trim(),
      phone: body.phone,
      profilePicture
    }
  });
  res.json(userDto(user));
}));

router.put("/:id/password", authenticate, requireRoles("ADMIN"), validate({ params: idParams, body: resetPasswordBody }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  const body = req.body as z.infer<typeof resetPasswordBody>;
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found");

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { passwordHash: await hashUserPassword(body.password) }
  });

  res.json(userDto(user));
}));

router.put("/:id", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), uploadProfile.single("profile"), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  const body = updateUserBody.parse(req.body);
  await assertEmailAvailable(body.email, params.id);
  const current = await prisma.user.findUniqueOrThrow({
    where: { id: params.id },
    select: { role: true, monthlyStatus: true, membershipExpiresAt: true }
  });
  const nextRole = body.role ?? current.role;
  const membership = normalizeMembership({ ...body, role: nextRole }, current);
  const profilePicture = publicUploadUrl(req.file) ?? body.profilePicture ?? body.profile_picture;
  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: body.name,
      email: body.email?.toLowerCase().trim(),
      role: body.role,
      monthlyStatus: membership.monthlyStatus,
      membershipExpiresAt: membership.membershipExpiresAt,
      phone: body.phone,
      profilePicture
    }
  });
  res.json(userDto(user));
}));

router.delete("/:id", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  if (req.auth?.userId === params.id) throw new AppError(409, "CANNOT_DELETE_SELF", "You cannot delete your own account");
  await prisma.user.delete({ where: { id: params.id } });
  res.status(204).send();
}));

export { router as userRouter };
