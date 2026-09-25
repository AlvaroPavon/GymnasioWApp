import { addMinutes, isAfter } from "date-fns";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { minutesBefore } from "../utils/time.js";
import { expoPushService, type PushNotifier } from "./push.service.js";
import { broadcastDataChanged } from "./realtime.service.js";

type TxClient = Prisma.TransactionClient;

type ClassLockRow = {
  id: number;
  titulo: string;
  tipo_clase_id: number;
  teacher_id: number;
  capacidad_maxima: number;
  fecha_hora_inicio: Date;
  fecha_hora_fin: Date;
};

type ReservationLockRow = {
  id: number;
  user_id: number;
  estado: "CONFIRMADA" | "EN_ESPERA" | "ASISTENCIA_VALIDADA" | "NO_ASISTE" | "CANCELADA";
};

type WaitlistCandidateRow = {
  id: number;
  user_id: number;
};

export type PromotedUser = {
  userId: number;
  classId: number;
  classTitle: string;
};

const OCCUPYING_STATUSES = new Set(["CONFIRMADA", "ASISTENCIA_VALIDADA"]);
const NON_REBOOKABLE_STATUSES = new Set(["CONFIRMADA", "EN_ESPERA", "ASISTENCIA_VALIDADA", "NO_ASISTE"]);

export class ReservationService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly push: PushNotifier = expoPushService
  ) {}

  /**
   * Creates or reactivates a reservation using a class-level DB lock.
   * The class row is the serialization point, preventing overbooking even under concurrent requests.
   */
  async reserveClass(userId: number, classId: number, now = new Date(), hideName = false) {
    return this.db.$transaction(async (tx) => {
      const gymClass = await this.lockClass(tx, classId);
      if (!isAfter(gymClass.fecha_hora_inicio, now)) {
        throw new AppError(409, "CLASS_ALREADY_STARTED", "Cannot reserve a class that already started");
      }
      if (!isAfter(minutesBefore(gymClass.fecha_hora_inicio, 30), now)) {
        throw new AppError(409, "RESERVATION_CLOSED", "Reservations close 30 minutes before class start");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, monthlyStatus: true, membershipExpiresAt: true }
      });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
      if (user.role !== "CLIENT") throw new AppError(403, "ONLY_CLIENTS_CAN_RESERVE", "Only clients can reserve classes");
      if (user.monthlyStatus !== "PAGADO" || !user.membershipExpiresAt || !isAfter(user.membershipExpiresAt, now)) {
        throw new AppError(403, "MEMBERSHIP_REQUIRED", "Active membership payment is required before reserving");
      }

      const lockedReservations = await this.lockReservationsForClass(tx, classId);
      const activeCount = lockedReservations.filter((reservation) => OCCUPYING_STATUSES.has(reservation.estado)).length;
      const nextStatus = activeCount < gymClass.capacidad_maxima ? "CONFIRMADA" : "EN_ESPERA";

      const existing = await tx.reservation.findUnique({
        where: { userId_classId: { userId, classId } }
      });
      if (existing && NON_REBOOKABLE_STATUSES.has(existing.status)) {
        throw new AppError(409, "RESERVATION_ALREADY_EXISTS", "User already has an active reservation for this class");
      }

      const reservation = existing
        ? await tx.reservation.update({
            where: { id: existing.id },
            data: {
              status: nextStatus,
              requestedAt: now,
              promotedAt: null,
              hideName,
              fixedEnrollment: false,
              reminderSentAt: null
            }
          })
        : await tx.reservation.create({
            data: { userId, classId, status: nextStatus, requestedAt: now, hideName }
          });

      return { reservation, status: nextStatus };
    }, this.transactionOptions());
  }

  /**
   * Cancels a reservation and promotes waitlisted users if capacity becomes available.
   * Admins can remove anyone; teachers can remove users only from their own class; clients can cancel themselves.
   */
  async cancelReservationAndPromote(input: {
    actorUserId: number;
    actorRole: "ADMIN" | "TEACHER" | "CLIENT";
    targetUserId: number;
    classId: number;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const result = await this.db.$transaction(async (tx) => {
      const gymClass = await this.lockClass(tx, input.classId);
      if (!isAfter(gymClass.fecha_hora_inicio, now)) {
        throw new AppError(409, "CLASS_ALREADY_STARTED", "Cannot cancel a reservation after the class has started");
      }
      await this.assertCanCancel(tx, input, gymClass);
      await this.lockReservationsForClass(tx, input.classId);

      const reservation = await tx.reservation.findUnique({
        where: { userId_classId: { userId: input.targetUserId, classId: input.classId } }
      });
      if (!reservation) throw new AppError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
      if (reservation.status === "NO_ASISTE") {
        throw new AppError(409, "CANNOT_CANCEL_NO_SHOW", "A no-show reservation cannot be cancelled");
      }
      if (reservation.status === "CANCELADA") return { cancelled: reservation, promoted: [] as PromotedUser[] };

      const wasOccupying = OCCUPYING_STATUSES.has(reservation.status);
      const cancelled = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "CANCELADA" }
      });

      const promoted = wasOccupying ? await this.promoteWaitlistForLockedClass(tx, gymClass, now) : [];
      return { cancelled, promoted };
    }, this.transactionOptions());

    await this.notifyPromotedBestEffort(result.promoted);
    return result;
  }

  /** Changes only the authenticated client's privacy choice for an existing reservation. */
  async setReservationPrivacy(userId: number, classId: number, hideName: boolean) {
    const reservation = await this.db.reservation.findUnique({
      where: { userId_classId: { userId, classId } },
      select: { id: true, status: true }
    });
    if (!reservation || reservation.status === "CANCELADA") {
      throw new AppError(404, "RESERVATION_NOT_FOUND", "Active reservation not found");
    }

    return this.db.reservation.update({
      where: { id: reservation.id },
      data: { hideName }
    });
  }

  /** Promotes all eligible waitlisted users who fit after a capacity increase in the caller's transaction. */
  async promoteWaitlistForCapacityIncrease(tx: TxClient, classId: number, now = new Date()) {
    const gymClass = await this.lockClass(tx, classId);
    return this.promoteWaitlistForLockedClass(tx, gymClass, now);
  }

  /** Push delivery happens after commit and must never change the committed operation's result. */
  async notifyPromotedBestEffort(promoted: PromotedUser[]) {
    for (const user of promoted) {
      try {
        await this.push.sendToUser(user.userId, {
          title: "Plaza confirmada",
          body: `Se ha liberado una plaza para ${user.classTitle}. Tu reserva ya está confirmada.`,
          data: { classId: user.classId, type: "WAITLIST_PROMOTED" }
        });
      } catch (error) {
        console.error("Push notification failed after committed waitlist promotion", {
          userId: user.userId,
          classId: user.classId,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
      }
    }
  }

  /**
   * Marks attendance as validated until the applicable cutoff.
   * Users promoted after the normal 30-minute cutoff may validate until class start.
   * Validating attendance deactivates active penalties for that class type.
   */
  async validateAttendance(userId: number, classId: number, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      const gymClass = await this.lockClass(tx, classId);
      if (!isAfter(gymClass.fecha_hora_inicio, now)) {
        throw new AppError(409, "ATTENDANCE_VALIDATION_CLOSED", "Attendance cannot be validated after class start");
      }

      const reservation = await tx.reservation.findUnique({ where: { userId_classId: { userId, classId } } });
      if (!reservation) throw new AppError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
      if (reservation.status === "ASISTENCIA_VALIDADA") return reservation;
      if (reservation.status !== "CONFIRMADA") {
        throw new AppError(409, "RESERVATION_NOT_CONFIRMED", "Only confirmed reservations can validate attendance");
      }

      const standardDeadline = minutesBefore(gymClass.fecha_hora_inicio, 30);
      const deadline = reservation.promotedAt && !isAfter(standardDeadline, reservation.promotedAt)
        ? gymClass.fecha_hora_inicio
        : standardDeadline;
      if (isAfter(now, deadline)) {
        throw new AppError(409, "ATTENDANCE_VALIDATION_CLOSED", "Attendance validation is closed for this reservation");
      }

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "ASISTENCIA_VALIDADA" }
      });

      await tx.penalty.updateMany({
        where: { userId, classTypeId: gymClass.tipo_clase_id, active: true },
        data: { active: false }
      });

      return updated;
    }, this.transactionOptions());
  }

  /**
   * Cron job: within 30 minutes before class start, unvalidated confirmed reservations become NO_ASISTE.
   * Each no-show receives an active penalty, then capacity is released to the waitlist.
   */
  async processMissedAttendance(now = new Date()) {
    const windowEnd = addMinutes(now, 30);
    const classes = await this.db.gymClass.findMany({
      where: { startsAt: { gt: now, lte: windowEnd } },
      select: { id: true }
    });

    const totals = { classesProcessed: 0, noShows: 0, penaltiesCreated: 0, promoted: 0 };
    for (const gymClass of classes) {
      const result = await this.processMissedAttendanceForClass(gymClass.id, now);
      totals.classesProcessed += 1;
      totals.noShows += result.noShows;
      totals.penaltiesCreated += result.penaltiesCreated;
      totals.promoted += result.promoted.length;
      await this.notifyPromotedBestEffort(result.promoted);
    }

    if (totals.noShows > 0 || totals.promoted > 0 || totals.penaltiesCreated > 0) {
      broadcastDataChanged("classes");
    }

    return totals;
  }

  /** Sends one opt-in push reminder one hour before each confirmed booking. */
  async sendReservationReminders(now = new Date()) {
    const windowStart = addMinutes(now, 60);
    const windowEnd = addMinutes(now, 61);
    const reservations = await this.db.reservation.findMany({
      where: {
        status: { in: ["CONFIRMADA", "ASISTENCIA_VALIDADA"] },
        reminderSentAt: null,
        user: { is: { classReminderEnabled: true } },
        gymClass: { startsAt: { gte: windowStart, lt: windowEnd } }
      },
      include: { gymClass: { select: { id: true, title: true, startsAt: true } } }
    });

    let sent = 0;
    let failed = 0;
    for (const reservation of reservations) {
      const claimedAt = new Date();
      const claimed = await this.db.reservation.updateMany({
        where: { id: reservation.id, reminderSentAt: null },
        data: { reminderSentAt: claimedAt }
      });
      if (claimed.count !== 1) continue;

      try {
        await this.push.sendToUser(reservation.userId, {
          title: "Tu clase comienza en 1 hora",
          body: `${reservation.gymClass.title} empieza dentro de una hora.`,
          data: { classId: reservation.gymClass.id, type: "CLASS_REMINDER" }
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        await this.db.reservation.updateMany({
          where: { id: reservation.id, reminderSentAt: claimedAt },
          data: { reminderSentAt: null }
        });
        console.error("Class reminder push failed", {
          userId: reservation.userId,
          classId: reservation.gymClass.id,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
      }
    }

    return { sent, failed };
  }

  private async processMissedAttendanceForClass(classId: number, now: Date) {
    const result = await this.db.$transaction(async (tx) => {
      const gymClass = await this.lockClass(tx, classId);
      if (!isAfter(gymClass.fecha_hora_inicio, now) || isAfter(gymClass.fecha_hora_inicio, addMinutes(now, 30))) {
        return { noShows: 0, penaltiesCreated: 0, promoted: [] as PromotedUser[] };
      }

      await this.lockReservationsForClass(tx, classId);
      const standardDeadline = minutesBefore(gymClass.fecha_hora_inicio, 30);
      const missed = await tx.reservation.findMany({
        where: {
          classId,
          status: "CONFIRMADA",
          OR: [
            { promotedAt: null },
            { promotedAt: { lt: standardDeadline } }
          ]
        },
        select: { id: true, userId: true }
      });

      let penaltiesCreated = 0;
      for (const reservation of missed) {
        await tx.reservation.update({ where: { id: reservation.id }, data: { status: "NO_ASISTE" } });

        const existingActivePenalty = await tx.penalty.findFirst({
          where: { userId: reservation.userId, classTypeId: gymClass.tipo_clase_id, active: true },
          select: { id: true }
        });
        if (!existingActivePenalty) {
          await tx.penalty.create({ data: { userId: reservation.userId, classTypeId: gymClass.tipo_clase_id, active: true } });
          penaltiesCreated += 1;
        }
      }

      const promoted = missed.length > 0 ? await this.promoteWaitlistForLockedClass(tx, gymClass, now) : [];
      return { noShows: missed.length, penaltiesCreated, promoted };
    }, this.transactionOptions());

    return result;
  }

  private async lockClass(tx: TxClient, classId: number): Promise<ClassLockRow> {
    const rows = await tx.$queryRaw<ClassLockRow[]>`
      SELECT id, titulo, tipo_clase_id, teacher_id, capacidad_maxima, fecha_hora_inicio, fecha_hora_fin
      FROM Clases
      WHERE id = ${classId}
      FOR UPDATE
    `;
    const gymClass = rows[0];
    if (!gymClass) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    return gymClass;
  }

  private async lockReservationsForClass(tx: TxClient, classId: number): Promise<ReservationLockRow[]> {
    return tx.$queryRaw<ReservationLockRow[]>`
      SELECT id, user_id, estado
      FROM Reservas
      WHERE clase_id = ${classId}
      FOR UPDATE
    `;
  }

  private async promoteWaitlistForLockedClass(tx: TxClient, gymClass: ClassLockRow, now: Date): Promise<PromotedUser[]> {
    if (!isAfter(gymClass.fecha_hora_inicio, now)) return [];

    const lockedReservations = await this.lockReservationsForClass(tx, gymClass.id);
    let activeCount = lockedReservations.filter((reservation) => OCCUPYING_STATUSES.has(reservation.estado)).length;
    const promoted: PromotedUser[] = [];

    while (activeCount < gymClass.capacidad_maxima) {
      const candidates = await tx.$queryRaw<WaitlistCandidateRow[]>`
        SELECT r.id, r.user_id
        FROM Reservas r
        INNER JOIN Usuarios u ON u.id = r.user_id
        WHERE r.clase_id = ${gymClass.id}
          AND r.estado = 'EN_ESPERA'
          AND u.estado_mensualidad = 'PAGADO'
          AND u.membership_expires_at IS NOT NULL
           AND u.membership_expires_at > ${now}
        ORDER BY
          CASE WHEN EXISTS (
            SELECT 1
            FROM Penalizaciones p
            WHERE p.user_id = r.user_id
              AND p.tipo_clase_id = ${gymClass.tipo_clase_id}
              AND p.activa = TRUE
          ) THEN 1 ELSE 0 END ASC,
          r.fecha_solicitud ASC,
          r.id ASC
        LIMIT 1
        FOR UPDATE
      `;

      const candidate = candidates[0];
      if (!candidate) break;

      await tx.reservation.update({
        where: { id: candidate.id },
        data: { status: "CONFIRMADA", promotedAt: now }
      });
      promoted.push({ userId: candidate.user_id, classId: gymClass.id, classTitle: gymClass.titulo });
      activeCount += 1;
    }

    return promoted;
  }

  private async assertCanCancel(
    tx: TxClient,
    input: { actorUserId: number; actorRole: "ADMIN" | "TEACHER" | "CLIENT"; targetUserId: number },
    gymClass: ClassLockRow
  ) {
    if (input.actorRole === "ADMIN") return;
    if (input.actorRole === "TEACHER") {
      if (gymClass.teacher_id !== input.actorUserId) {
        throw new AppError(403, "TEACHER_NOT_CLASS_OWNER", "Teachers can only manage their own classes");
      }
      return;
    }
    if (input.actorUserId !== input.targetUserId) {
      throw new AppError(403, "FORBIDDEN", "Clients can only cancel their own reservations");
    }

    const actor = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { id: true } });
    if (!actor) throw new AppError(404, "USER_NOT_FOUND", "Actor user not found");
  }

  private transactionOptions() {
    return {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000
    } as const;
  }
}

export const reservationService = new ReservationService();
