import request from "supertest";
import { addMinutes } from "date-fns";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { expoPushService } from "../src/services/push.service.js";
import { reservationService } from "../src/services/reservation.service.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createGymClass, createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();

describe("Reservation endpoints", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accepts reservations only before the exact 30-minute cutoff", async () => {
    const teacher = await createUser({ email: "cutoff-teacher@test.local", role: "TEACHER" });
    const beforeCutoff = await createUser({ email: "before-cutoff@test.local" });
    const atCutoff = await createUser({ email: "at-cutoff@test.local" });
    const insideCutoff = await createUser({ email: "inside-cutoff@test.local" });
    const atStart = await createUser({ email: "at-start@test.local" });
    const startsAt = addMinutes(new Date(), 120);
    const cutoff = addMinutes(startsAt, -30);
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 5, startsAt });

    await expect(reservationService.reserveClass(
      beforeCutoff.id,
      gymClass.id,
      new Date(cutoff.getTime() - 1)
    )).resolves.toMatchObject({ status: "CONFIRMADA" });

    await expect(reservationService.reserveClass(atCutoff.id, gymClass.id, cutoff))
      .rejects.toMatchObject({ code: "RESERVATION_CLOSED" });
    await expect(reservationService.reserveClass(
      insideCutoff.id,
      gymClass.id,
      new Date(cutoff.getTime() + 1)
    )).rejects.toMatchObject({ code: "RESERVATION_CLOSED" });
    await expect(reservationService.reserveClass(atStart.id, gymClass.id, startsAt))
      .rejects.toMatchObject({ code: "CLASS_ALREADY_STARTED" });
  });

  it("lets a user promoted at the exact cutoff validate until class start", async () => {
    const admin = await createUser({ email: "cutoff-promotion-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "cutoff-promotion-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "cutoff-promotion-occupant@test.local" });
    const waitlisted = await createUser({ email: "cutoff-promotion-waitlisted@test.local" });
    const startsAt = addMinutes(new Date(), 120);
    const cutoff = addMinutes(startsAt, -30);
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1, startsAt });
    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA" },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA" }
      ]
    });

    const result = await reservationService.cancelReservationAndPromote({
      actorUserId: admin.id,
      actorRole: admin.role,
      targetUserId: occupant.id,
      classId: gymClass.id,
      now: cutoff
    });

    expect(result.promoted).toHaveLength(1);
    await expect(prisma.reservation.findUniqueOrThrow({
      where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } }
    })).resolves.toMatchObject({ status: "CONFIRMADA", promotedAt: cutoff });
    await expect(reservationService.validateAttendance(
      waitlisted.id,
      gymClass.id,
      new Date(cutoff.getTime() + 1)
    )).resolves.toMatchObject({ status: "ASISTENCIA_VALIDADA" });
  });

  it("prevents transactional overbooking under concurrent requests", async () => {
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const clientA = await createUser({ email: "a@test.local", role: "CLIENT", monthlyStatus: "PAGADO" });
    const clientB = await createUser({ email: "b@test.local", role: "CLIENT", monthlyStatus: "PAGADO" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1 });

    const [responseA, responseB] = await Promise.all([
      request(app)
        .post(`/api/classes/${gymClass.id}/reservations`)
        .set("Authorization", `Bearer ${signAccessToken({ userId: clientA.id, role: clientA.role })}`),
      request(app)
        .post(`/api/classes/${gymClass.id}/reservations`)
        .set("Authorization", `Bearer ${signAccessToken({ userId: clientB.id, role: clientB.role })}`)
    ]);

    expect(responseA.status).toBe(201);
    expect(responseB.status).toBe(201);
    expect([responseA.body.status, responseB.body.status].sort()).toEqual(["CONFIRMADA", "EN_ESPERA"].sort());

    const confirmedCount = await prisma.reservation.count({ where: { classId: gymClass.id, status: "CONFIRMADA" } });
    expect(confirmedCount).toBe(1);
  });

  it("blocks reservations from clients with unpaid monthly status", async () => {
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const client = await createUser({ email: "unpaid@test.local", role: "CLIENT", monthlyStatus: "IMPAGADO" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 5 });

    const response = await request(app)
      .post(`/api/classes/${gymClass.id}/reservations`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: client.id, role: client.role })}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBERSHIP_REQUIRED");
    await expect(prisma.reservation.findMany({ where: { userId: client.id } })).resolves.toHaveLength(0);
  });

  it("blocks reservations when client membership date is expired", async () => {
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const client = await createUser({ email: "expired@test.local", role: "CLIENT", monthlyStatus: "PAGADO" });
    await prisma.user.update({ where: { id: client.id }, data: { membershipExpiresAt: addMinutes(new Date(), -5) } });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 5 });

    const response = await request(app)
      .post(`/api/classes/${gymClass.id}/reservations`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: client.id, role: client.role })}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBERSHIP_REQUIRED");
  });

  it("promotes non-penalized waitlisted users before penalized users", async () => {
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "occupant@test.local" });
    const penalized = await createUser({ email: "penalized@test.local" });
    const clean = await createUser({ email: "clean@test.local" });
    const { classType, gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1 });

    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: new Date("2026-01-01T10:00:00.000Z") },
        { userId: penalized.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:01:00.000Z") },
        { userId: clean.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:02:00.000Z") }
      ]
    });
    await prisma.penalty.create({ data: { userId: penalized.id, classTypeId: classType.id, active: true } });

    const response = await request(app)
      .delete(`/api/classes/${gymClass.id}/reservations/${occupant.id}`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);

    expect(response.status).toBe(200);

    const cleanReservation = await prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: clean.id, classId: gymClass.id } } });
    const penalizedReservation = await prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: penalized.id, classId: gymClass.id } } });
    expect(cleanReservation.status).toBe("CONFIRMADA");
    expect(cleanReservation.promotedAt).toBeInstanceOf(Date);
    expect(penalizedReservation.status).toBe("EN_ESPERA");
  });

  it("promotes enough waitlisted users in priority order when capacity increases", async () => {
    const admin = await createUser({ email: "capacity-promotion-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "capacity-promotion-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "capacity-promotion-occupant@test.local" });
    const penalizedEarly = await createUser({ email: "capacity-promotion-penalized-early@test.local" });
    const cleanEarly = await createUser({ email: "capacity-promotion-clean-early@test.local" });
    const cleanLate = await createUser({ email: "capacity-promotion-clean-late@test.local" });
    const penalizedLate = await createUser({ email: "capacity-promotion-penalized-late@test.local" });
    const { classType, gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1 });

    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: new Date("2026-01-01T09:59:00.000Z") },
        { userId: penalizedEarly.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:00:00.000Z") },
        { userId: cleanEarly.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:01:00.000Z") },
        { userId: cleanLate.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:02:00.000Z") },
        { userId: penalizedLate.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:03:00.000Z") }
      ]
    });
    await prisma.penalty.createMany({
      data: [
        { userId: penalizedEarly.id, classTypeId: classType.id, active: true },
        { userId: penalizedLate.id, classTypeId: classType.id, active: true }
      ]
    });
    const pushSpy = jest.spyOn(expoPushService, "sendToUser").mockResolvedValue();

    const response = await request(app)
      .put(`/api/classes/${gymClass.id}`)
      .send({ maxCapacity: 4 })
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ maxCapacity: 4, _count: { reservations: 4 } });
    const reservations = await prisma.reservation.findMany({
      where: { classId: gymClass.id },
      orderBy: { requestedAt: "asc" }
    });
    expect(reservations.filter((reservation) => reservation.status === "CONFIRMADA").map((reservation) => reservation.userId))
      .toEqual([occupant.id, penalizedEarly.id, cleanEarly.id, cleanLate.id]);
    expect(reservations.find((reservation) => reservation.userId === penalizedLate.id)?.status).toBe("EN_ESPERA");
    expect(pushSpy.mock.calls.map(([userId]) => userId)).toEqual([
      cleanEarly.id,
      cleanLate.id,
      penalizedEarly.id
    ]);
  });

  it("allows a user promoted inside the cutoff to validate before class start", async () => {
    const admin = await createUser({ email: "late-promotion-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "late-promotion-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "late-promotion-occupant@test.local" });
    const waitlisted = await createUser({ email: "late-promotion-waitlisted@test.local" });
    const startsAt = addMinutes(new Date(), 20);
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1, startsAt });

    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA" },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA" }
      ]
    });

    const cancelResponse = await request(app)
      .delete(`/api/classes/${gymClass.id}/reservations/${occupant.id}`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);
    expect(cancelResponse.status).toBe(200);

    const promoted = await prisma.reservation.findUniqueOrThrow({
      where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } }
    });
    expect(promoted).toMatchObject({ status: "CONFIRMADA" });
    expect(promoted.promotedAt).toBeInstanceOf(Date);
    expect(promoted.promotedAt!.getTime()).toBeGreaterThan(addMinutes(startsAt, -30).getTime());

    const classesResponse = await request(app)
      .get("/api/classes")
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);
    expect(classesResponse.status).toBe(200);
    const publicReservation = classesResponse.body[0].reservations.find(
      (reservation: { userId: number }) => reservation.userId === waitlisted.id
    );
    expect(publicReservation).toMatchObject({
      promotedAt: promoted.promotedAt!.toISOString(),
      promoted_at: promoted.promotedAt!.toISOString(),
      promovida_en: promoted.promotedAt!.toISOString()
    });

    const validateResponse = await request(app)
      .post(`/api/classes/${gymClass.id}/attendance/validate`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: waitlisted.id, role: waitlisted.role })}`);
    expect(validateResponse.status).toBe(200);
    expect(validateResponse.body.reservation.status).toBe("ASISTENCIA_VALIDADA");
  });

  it("rejects cancellation after class start and never promotes the waitlist", async () => {
    const admin = await createUser({ email: "started-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "started-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "started-occupant@test.local" });
    const waitlisted = await createUser({ email: "started-waitlisted@test.local" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1, startsAt: addMinutes(new Date(), -5) });

    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA" },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA" }
      ]
    });

    const response = await request(app)
      .delete(`/api/classes/${gymClass.id}/reservations/${occupant.id}`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CLASS_ALREADY_STARTED");
    await expect(prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: occupant.id, classId: gymClass.id } } }))
      .resolves.toMatchObject({ status: "CONFIRMADA" });
    await expect(prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } } }))
      .resolves.toMatchObject({ status: "EN_ESPERA", promotedAt: null });
  });

  it("rejects capacity below confirmed and validated occupancy", async () => {
    const admin = await createUser({ email: "capacity-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "capacity-teacher@test.local", role: "TEACHER" });
    const confirmed = await createUser({ email: "capacity-confirmed@test.local" });
    const validated = await createUser({ email: "capacity-validated@test.local" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 3 });
    await prisma.reservation.createMany({
      data: [
        { userId: confirmed.id, classId: gymClass.id, status: "CONFIRMADA" },
        { userId: validated.id, classId: gymClass.id, status: "ASISTENCIA_VALIDADA" }
      ]
    });

    const response = await request(app)
      .put(`/api/classes/${gymClass.id}`)
      .send({ maxCapacity: 1 })
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "CAPACITY_BELOW_OCCUPANCY",
      details: { requestedCapacity: 1, occupied: 2 }
    });
    await expect(prisma.gymClass.findUniqueOrThrow({ where: { id: gymClass.id } }))
      .resolves.toMatchObject({ maxCapacity: 3 });
  });

  it("serializes capacity reduction with a concurrent reservation", async () => {
    const admin = await createUser({ email: "concurrent-capacity-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "concurrent-capacity-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "concurrent-capacity-occupant@test.local" });
    const newcomer = await createUser({ email: "concurrent-capacity-newcomer@test.local" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 2 });
    await prisma.reservation.create({
      data: { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA" }
    });

    const [capacityResponse, reservationResponse] = await Promise.all([
      request(app)
        .put(`/api/classes/${gymClass.id}`)
        .send({ maxCapacity: 1 })
        .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`),
      request(app)
        .post(`/api/classes/${gymClass.id}/reservations`)
        .set("Authorization", `Bearer ${signAccessToken({ userId: newcomer.id, role: newcomer.role })}`)
    ]);

    expect(reservationResponse.status).toBe(201);
    expect([200, 409]).toContain(capacityResponse.status);

    const updatedClass = await prisma.gymClass.findUniqueOrThrow({ where: { id: gymClass.id } });
    const reservations = await prisma.reservation.findMany({ where: { classId: gymClass.id } });
    const occupied = reservations.filter((reservation) => ["CONFIRMADA", "ASISTENCIA_VALIDADA"].includes(reservation.status)).length;
    expect(occupied).toBeLessThanOrEqual(updatedClass.maxCapacity);

    if (capacityResponse.status === 200) {
      expect(updatedClass.maxCapacity).toBe(1);
      expect(reservationResponse.body.status).toBe("EN_ESPERA");
    } else {
      expect(capacityResponse.body.error.code).toBe("CAPACITY_BELOW_OCCUPANCY");
      expect(updatedClass.maxCapacity).toBe(2);
      expect(reservationResponse.body.status).toBe("CONFIRMADA");
    }
  });

  it("serializes capacity promotion with a concurrent reservation without overbooking", async () => {
    const admin = await createUser({ email: "concurrent-promotion-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "concurrent-promotion-teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "concurrent-promotion-occupant@test.local" });
    const queued = await createUser({ email: "concurrent-promotion-queued@test.local" });
    const newcomer = await createUser({ email: "concurrent-promotion-newcomer@test.local" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1 });
    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: new Date("2026-01-01T10:00:00.000Z") },
        { userId: queued.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:01:00.000Z") }
      ]
    });

    const [capacityResponse, reservationResponse] = await Promise.all([
      request(app)
        .put(`/api/classes/${gymClass.id}`)
        .send({ maxCapacity: 2 })
        .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`),
      request(app)
        .post(`/api/classes/${gymClass.id}/reservations`)
        .set("Authorization", `Bearer ${signAccessToken({ userId: newcomer.id, role: newcomer.role })}`)
    ]);

    expect(capacityResponse.status).toBe(200);
    expect(reservationResponse.status).toBe(201);
    const updatedClass = await prisma.gymClass.findUniqueOrThrow({ where: { id: gymClass.id } });
    const reservations = await prisma.reservation.findMany({ where: { classId: gymClass.id } });
    const occupied = reservations.filter((reservation) => ["CONFIRMADA", "ASISTENCIA_VALIDADA"].includes(reservation.status));
    expect(updatedClass.maxCapacity).toBe(2);
    expect(occupied).toHaveLength(2);
    expect(occupied.map((reservation) => reservation.userId)).toEqual(expect.arrayContaining([occupant.id, queued.id]));
    expect(reservations.find((reservation) => reservation.userId === newcomer.id)?.status).toBe("EN_ESPERA");
  });

  it("lets the owning teacher remove a user and exposes occupied capacity separately from waitlist", async () => {
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const occupant = await createUser({ email: "occupant@test.local" });
    const waitlisted = await createUser({ email: "waitlisted@test.local" });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 1 });

    await prisma.reservation.createMany({
      data: [
        { userId: occupant.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: new Date("2026-01-01T10:00:00.000Z") },
        { userId: waitlisted.id, classId: gymClass.id, status: "EN_ESPERA", requestedAt: new Date("2026-01-01T10:01:00.000Z") }
      ]
    });

    const listBefore = await request(app)
      .get("/api/classes")
      .set("Authorization", `Bearer ${signAccessToken({ userId: teacher.id, role: teacher.role })}`);
    expect(listBefore.status).toBe(200);
    expect(listBefore.body[0]._count.reservations).toBe(1);
    expect(listBefore.body[0].reservations).toHaveLength(2);

    const response = await request(app)
      .delete(`/api/classes/${gymClass.id}/reservations/${occupant.id}`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: teacher.id, role: teacher.role })}`);

    expect(response.status).toBe(200);
    const promotedReservation = await prisma.reservation.findUniqueOrThrow({ where: { userId_classId: { userId: waitlisted.id, classId: gymClass.id } } });
    expect(promotedReservation.status).toBe("CONFIRMADA");
  });

  it("returns public attendee summaries to clients and full identities to privileged roles", async () => {
    const admin = await createUser({ email: "privacy-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "privacy-teacher@test.local", role: "TEACHER" });
    const clientA = await createUser({
      email: "privacy-a@test.local",
      role: "CLIENT",
      name: "Privacy Client A"
    });
    const clientB = await createUser({
      email: "privacy-b@test.local",
      role: "CLIENT",
      name: "Privacy Client B"
    });
    const { gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 2 });

    await prisma.reservation.createMany({
      data: [
        { userId: clientA.id, classId: gymClass.id, status: "CONFIRMADA" },
        { userId: clientB.id, classId: gymClass.id, status: "CONFIRMADA" }
      ]
    });

    const authorizationFor = (user: typeof admin) =>
      `Bearer ${signAccessToken({ userId: user.id, role: user.role })}`;
    const [clientResponse, teacherResponse, adminResponse] = await Promise.all([
      request(app).get("/api/classes").set("Authorization", authorizationFor(clientA)),
      request(app).get("/api/classes").set("Authorization", authorizationFor(teacher)),
      request(app).get("/api/classes").set("Authorization", authorizationFor(admin))
    ]);

    expect(clientResponse.status).toBe(200);
    expect(clientResponse.body[0]).toMatchObject({
      maxCapacity: 2,
      _count: { reservations: 2 }
    });
    expect(clientResponse.body[0].reservations).toHaveLength(2);
    expect(clientResponse.body[0].reservations.map((reservation: { user: { id: number; name: string } }) => reservation.user))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: clientA.id, name: clientA.name }),
        expect.objectContaining({ id: clientB.id, name: clientB.name })
      ]));
    expect(JSON.stringify(clientResponse.body)).not.toContain(clientA.email);
    expect(JSON.stringify(clientResponse.body)).not.toContain(clientB.email);

    for (const privilegedResponse of [teacherResponse, adminResponse]) {
      expect(privilegedResponse.status).toBe(200);
      expect(privilegedResponse.body[0].reservations).toHaveLength(2);
      expect(privilegedResponse.body[0].reservations.map((reservation: { id: number }) => reservation.id))
        .toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]));
      expect(privilegedResponse.body[0].reservations.map((reservation: { user: { email: string } }) => reservation.user.email))
        .toEqual(expect.arrayContaining([clientA.email, clientB.email]));
    }
  });

  it("uses a public teacher summary for clients and full teacher data for privileged roles", async () => {
    const admin = await createUser({ email: "teacher-dto-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({
      email: "teacher-dto-private@test.local",
      role: "TEACHER",
      name: "Private Teacher"
    });
    const client = await createUser({ email: "teacher-dto-client@test.local", role: "CLIENT" });
    await prisma.user.update({
      where: { id: teacher.id },
      data: { phone: "+34 600 555 010" }
    });
    await createGymClass({ teacherId: teacher.id, capacity: 5 });

    const authorizationFor = (user: typeof admin) =>
      `Bearer ${signAccessToken({ userId: user.id, role: user.role })}`;
    const [clientResponse, teacherResponse, adminResponse] = await Promise.all([
      request(app).get("/api/classes").set("Authorization", authorizationFor(client)),
      request(app).get("/api/classes").set("Authorization", authorizationFor(teacher)),
      request(app).get("/api/classes").set("Authorization", authorizationFor(admin))
    ]);

    expect(clientResponse.status).toBe(200);
    expect(clientResponse.body[0].teacher).toEqual({
      id: teacher.id,
      name: teacher.name,
      role: "TEACHER",
      profilePicture: null,
      profile_picture: null
    });
    for (const privateField of [
      "email",
      "phone",
      "passwordHash",
      "password_hash",
      "monthlyStatus",
      "estado_mensualidad",
      "membershipExpiresAt",
      "membership_expires_at",
      "membershipPayments",
      "payments"
    ]) {
      expect(clientResponse.body[0].teacher).not.toHaveProperty(privateField);
    }

    for (const privilegedResponse of [teacherResponse, adminResponse]) {
      expect(privilegedResponse.status).toBe(200);
      expect(privilegedResponse.body[0].teacher).toMatchObject({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        role: "TEACHER",
        phone: "+34 600 555 010",
        monthlyStatus: "PAGADO"
      });
    }
  });

  it("validates attendance and deactivates active penalties for the class type", async () => {
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const client = await createUser({ email: "client@test.local" });
    const { classType, gymClass } = await createGymClass({ teacherId: teacher.id, capacity: 5, startsAt: addMinutes(new Date(), 90) });
    await prisma.reservation.create({
      data: { userId: client.id, classId: gymClass.id, status: "CONFIRMADA", requestedAt: new Date() }
    });
    await prisma.penalty.create({ data: { userId: client.id, classTypeId: classType.id, active: true } });

    const response = await request(app)
      .post(`/api/classes/${gymClass.id}/attendance/validate`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: client.id, role: client.role })}`);

    expect(response.status).toBe(200);
    expect(response.body.reservation.status).toBe("ASISTENCIA_VALIDADA");
    const activePenalties = await prisma.penalty.count({ where: { userId: client.id, classTypeId: classType.id, active: true } });
    expect(activePenalties).toBe(0);
  });
});
