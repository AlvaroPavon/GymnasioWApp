import { addMinutes } from "date-fns";
import { prisma } from "../src/db/prisma.js";
import { type PushNotifier, type PushPayload } from "../src/services/push.service.js";
import { ReservationService } from "../src/services/reservation.service.js";
import { createGymClass, createUser, resetDatabase } from "./helpers/database.js";

class FakePush implements PushNotifier {
  public sent: Array<{ userId: number; payload: PushPayload }> = [];

  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    this.sent.push({ userId, payload });
  }
}

describe("Reservation cron jobs", () => {
  let fakePush: FakePush;
  let service: ReservationService;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    fakePush = new FakePush();
    service = new ReservationService(prisma, fakePush);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps a late promotion eligible across repeated sweeps and allows validation until class start", async () => {
    const now = new Date("2026-05-30T10:00:00.000Z");
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const noShow = await createUser({ email: "noshow@test.local" });
    const waitlisted = await createUser({ email: "wait@test.local" });
    const { classType, gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1, startsAt: addMinutes(now, 20) });

    await prisma.reservation.createMany({
      data: [
        { userId: noShow.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: addMinutes(now, -10) },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: addMinutes(now, -9) }
      ]
    });

    const result = await service.processMissedAttendance(now);
    const repeated = await service.processMissedAttendance(addMinutes(now, 1));

    expect(result.noShows).toBe(1);
    expect(result.penaltiesCreated).toBe(1);
    expect(result.promoted).toBe(1);
    expect(repeated).toMatchObject({ noShows: 0, penaltiesCreated: 0, promoted: 0 });

    const noShowReservation = await prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: noShow.id, classId: gymClass.id } } });
    const waitlistedReservation = await prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } } });
    const penalty = await prisma.penalty.findFirstOrThrow({ where: { userId: noShow.id, classTypeId: classType.id, active: true } });

    expect(noShowReservation.status).toBe("NO_ASISTE");
    expect(waitlistedReservation.status).toBe("CONFIRMADA");
    expect(waitlistedReservation.promotedAt).toEqual(now);
    expect(penalty.active).toBe(true);
    expect(fakePush.sent).toHaveLength(1);
    expect(fakePush.sent[0]?.userId).toBe(waitlisted.id);

    const validated = await service.validateAttendance(waitlisted.id, gymClass.id, addMinutes(now, 2));
    expect(validated.status).toBe("ASISTENCIA_VALIDADA");
    await expect(service.validateAttendance(waitlisted.id, gymClass.id, gymClass.startsAt))
      .rejects.toMatchObject({ code: "ATTENDANCE_VALIDATION_CLOSED" });
  });

  it("serializes concurrent sweep instances without duplicate penalties or promotions", async () => {
    const now = new Date("2026-05-30T11:00:00.000Z");
    const teacher = await createUser({ email: "concurrent-teacher@test.local", role: "TEACHER" });
    const noShow = await createUser({ email: "concurrent-noshow@test.local" });
    const waitlisted = await createUser({ email: "concurrent-wait@test.local" });
    const { classType, gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1, startsAt: addMinutes(now, 20) });

    await prisma.reservation.createMany({
      data: [
        { userId: noShow.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: addMinutes(now, -10) },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: addMinutes(now, -9) }
      ]
    });

    const secondService = new ReservationService(prisma, fakePush);
    const results = await Promise.all([
      service.processMissedAttendance(now),
      secondService.processMissedAttendance(now)
    ]);

    expect(results.reduce((sum, result) => sum + result.noShows, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.penaltiesCreated, 0)).toBe(1);
    expect(results.reduce((sum, result) => sum + result.promoted, 0)).toBe(1);
    await expect(prisma.penalty.count({ where: { userId: noShow.id, classTypeId: classType.id, active: true } })).resolves.toBe(1);
    await expect(prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } } }))
      .resolves.toMatchObject({ status: "CONFIRMADA", promotedAt: now });
    expect(fakePush.sent).toHaveLength(1);
  });

  it("sends one-hour reminders only to opted-in booked users and never duplicates them", async () => {
    const now = new Date("2026-05-30T10:00:00.000Z");
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const optedIn = await createUser({ email: "client@test.local" });
    const optedOut = await createUser({ email: "silent@test.local" });
    await prisma.user.update({
      where: { id: optedIn.id },
      data: { classReminderEnabled: true }
    });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 10, startsAt: addMinutes(now, 60) });

    await prisma.reservation.createMany({
      data: [
        { userId: optedIn.id, classId: gymClass.id, status: "ASISTENCIA_VALIDADA", requestedAt: addMinutes(now, -10) },
        { userId: optedOut.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: addMinutes(now, -10) }
      ]
    });

    const result = await service.sendReservationReminders(now);
    const repeated = await service.sendReservationReminders(now);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(repeated).toEqual({ sent: 0, failed: 0 });
    expect(fakePush.sent).toHaveLength(1);
    expect(fakePush.sent[0]?.userId).toBe(optedIn.id);
    expect(fakePush.sent[0]?.payload.data?.type).toBe("CLASS_REMINDER");
    await expect(prisma.reservation.findUniqueOrThrow({
      where: { userId_classId: { userId: optedIn.id, classId: gymClass.id } }
    })).resolves.toMatchObject({ reminderSentAt: expect.any(Date) });
  });
});
