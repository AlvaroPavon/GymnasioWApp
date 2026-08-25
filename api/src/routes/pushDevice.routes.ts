import { Expo } from "expo-server-sdk";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const pushDeviceBody = z.object({
  pushToken: z.string().min(20).max(191),
  platform: z.enum(["IOS", "ANDROID"])
}).strict();

router.post("/", authenticate, validate({ body: pushDeviceBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  if (!Expo.isExpoPushToken(req.body.pushToken)) {
    throw new AppError(400, "INVALID_PUSH_TOKEN", "pushToken must be a valid Expo push token");
  }

  const device = await prisma.pushDevice.upsert({
    where: { pushToken: req.body.pushToken },
    update: { userId: req.auth.userId, platform: req.body.platform },
    create: { userId: req.auth.userId, pushToken: req.body.pushToken, platform: req.body.platform }
  });

  res.status(201).json({ device });
}));

export { router as pushDeviceRouter };
