import { addMonths, isAfter } from "date-fns";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { userDto } from "../utils/dto.js";
import { broadcastDataChanged } from "./realtime.service.js";

type TxClient = Prisma.TransactionClient;

function normalizeMonths(months: number | undefined) {
  return Math.max(1, Math.min(months ?? 1, 24));
}

export function calculateMembershipRenewalDate(currentExpiresAt: Date | null, months: number, now = new Date()) {
  const baseDate = currentExpiresAt && isAfter(currentExpiresAt, now) ? currentExpiresAt : now;
  return addMonths(baseDate, normalizeMonths(months));
}

export class MembershipService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async reportPayment(userId: number, input: { amountCents?: number; notes?: string; paidAt?: Date }) {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (user.role !== "CLIENT") {
        throw new AppError(403, "MEMBERSHIP_NOT_REQUIRED", "Teachers and admins do not need membership payments");
      }

      const payment = await tx.membershipPayment.create({
        data: {
          userId,
          amountCents: input.amountCents,
          notes: input.notes,
          paidAt: input.paidAt ?? new Date()
        },
        include: { user: true }
      });

      const notification = await tx.adminNotification.create({
        data: {
          type: "PAYMENT_REPORTED",
          title: "Pago de mensualidad notificado",
          message: `${user.name} ha notificado un pago. Revísalo y confírmalo para renovar su acceso.`,
          userId,
          paymentId: payment.id
        }
      });

      return { payment, notification };
    });
  }

  async listPendingPayments() {
    const payments = await this.db.membershipPayment.findMany({
      where: { status: "PENDING_ADMIN_REVIEW" },
      orderBy: { createdAt: "asc" },
      include: { user: true }
    });

    return payments.map((payment) => ({
      id: payment.id,
      amountCents: payment.amountCents,
      amount_cents: payment.amountCents,
      status: payment.status,
      paidAt: payment.paidAt,
      paid_at: payment.paidAt,
      notes: payment.notes,
      createdAt: payment.createdAt,
      created_at: payment.createdAt,
      user: userDto(payment.user)
    }));
  }

  async confirmPayment(paymentId: number, adminId: number, input: { months?: number }) {
    return this.db.$transaction(async (tx) => {
      const payment = await tx.membershipPayment.findUnique({
        where: { id: paymentId },
        include: { user: true }
      });
      if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment report not found");
      if (payment.status !== "PENDING_ADMIN_REVIEW") {
        throw new AppError(409, "PAYMENT_ALREADY_REVIEWED", "Payment report was already reviewed");
      }
      if (payment.user.role !== "CLIENT") {
        throw new AppError(409, "MEMBERSHIP_NOT_REQUIRED", "Teachers and admins do not need membership payments");
      }

      const expiresAt = calculateMembershipRenewalDate(payment.user.membershipExpiresAt, input.months ?? 1);
      const [updatedPayment, user] = await Promise.all([
        tx.membershipPayment.update({
          where: { id: payment.id },
          data: {
            status: "CONFIRMED",
            reviewedById: adminId,
            reviewedAt: new Date()
          }
        }),
        tx.user.update({
          where: { id: payment.userId },
          data: {
            monthlyStatus: "PAGADO",
            membershipExpiresAt: expiresAt
          }
        })
      ]);

      await tx.adminNotification.updateMany({
        where: { paymentId: payment.id, readAt: null },
        data: { readAt: new Date() }
      });

      return { payment: updatedPayment, user: userDto(user) };
    });
  }

  async renewUserMembership(userId: number, adminId: number, input: { months?: number; amountCents?: number; notes?: string }) {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (user.role !== "CLIENT") {
        throw new AppError(409, "MEMBERSHIP_NOT_REQUIRED", "Teachers and admins do not need membership payments");
      }

      const expiresAt = calculateMembershipRenewalDate(user.membershipExpiresAt, input.months ?? 1);
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          monthlyStatus: "PAGADO",
          membershipExpiresAt: expiresAt
        }
      });

      const payment = await tx.membershipPayment.create({
        data: {
          userId,
          amountCents: input.amountCents,
          notes: input.notes ?? "Renovación manual realizada por un administrador",
          status: "CONFIRMED",
          reviewedById: adminId,
          reviewedAt: new Date(),
          paidAt: new Date()
        }
      });

      return { payment, user: userDto(updatedUser) };
    });
  }

  async expireOverdueMemberships(now = new Date()) {
    const users = await this.db.user.findMany({
      where: {
        role: "CLIENT",
        monthlyStatus: "PAGADO",
        membershipExpiresAt: { lt: now }
      }
    });

    if (users.length === 0) return { expired: 0 };

    await this.db.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: users.map((user) => user.id) } },
        data: { monthlyStatus: "IMPAGADO" }
      });

      await tx.adminNotification.createMany({
        data: users.map((user) => ({
          type: "MEMBERSHIP_EXPIRED",
          title: "Mensualidad caducada",
          message: `La mensualidad de ${user.name} ha caducado. No podrá reservar hasta que se renueve el pago.`,
          userId: user.id
        }))
      });
    });

    broadcastDataChanged("membership");

    return { expired: users.length };
  }

  async markExpiredIfNeeded(tx: TxClient, user: { id: number; monthlyStatus: string; membershipExpiresAt: Date | null }, now = new Date()) {
    if (user.monthlyStatus === "PAGADO" && user.membershipExpiresAt && !isAfter(user.membershipExpiresAt, now)) {
      await tx.user.update({ where: { id: user.id }, data: { monthlyStatus: "IMPAGADO" } });
      return true;
    }
    return false;
  }
}

export const membershipService = new MembershipService();
