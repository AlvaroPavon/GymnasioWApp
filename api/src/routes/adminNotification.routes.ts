import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { userDto } from "../utils/dto.js";

const router = Router();
const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();

function notificationDto(notification: {
  id: number;
  type: string;
  title: string;
  message: string;
  userId: number | null;
  paymentId: number | null;
  readAt: Date | null;
  createdAt: Date;
  user?: Parameters<typeof userDto>[0] | null;
  payment?: unknown;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    userId: notification.userId,
    user_id: notification.userId,
    paymentId: notification.paymentId,
    payment_id: notification.paymentId,
    readAt: notification.readAt,
    read_at: notification.readAt,
    createdAt: notification.createdAt,
    created_at: notification.createdAt,
    user: notification.user ? userDto(notification.user) : null,
    payment: notification.payment ?? null
  };
}

router.get("/", authenticate, requireRoles("ADMIN"), asyncHandler(async (_req, res) => {
  const notifications = await prisma.adminNotification.findMany({
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: { user: true, payment: true }
  });
  res.json(notifications.map(notificationDto));
}));

router.patch("/:id/read", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  const notification = await prisma.adminNotification.update({
    where: { id: params.id },
    data: { readAt: new Date() },
    include: { user: true, payment: true }
  });
  res.json(notificationDto(notification));
}));

export { router as adminNotificationRouter };
