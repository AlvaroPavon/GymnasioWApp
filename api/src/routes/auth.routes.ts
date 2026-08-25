import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { login, registerClient } from "../services/auth.service.js";
import { userDto } from "../utils/dto.js";

const router = Router();

const registerBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(191),
  password: z.string().min(10).max(128)
}).strict();

const loginBody = z.object({
  email: z.string().email().max(191),
  password: z.string().min(1).max(128)
}).strict();

router.post("/register", validate({ body: registerBody }), asyncHandler(async (req, res) => {
  const result = await registerClient(req.body);
  res.status(201).json(result);
}));

router.post("/login", validate({ body: loginBody }), asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.json(result);
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) throw new AppError(401, "INVALID_TOKEN", "Invalid or expired access token");
  res.json(userDto(user));
}));

export { router as authRouter };
