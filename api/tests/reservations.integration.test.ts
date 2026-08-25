import request from "supertest";
import { addMinutes } from "date-fns";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
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

  it("limits participant identities to admins and the owning teacher while clients see only themselves", async () => {
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
    expect(clientResponse.body[0].reservations).toHaveLength(1);
    expect(clientResponse.body[0].reservations[0]).toMatchObject({
      userId: clientA.id,
      user: { id: clientA.id, name: clientA.name, email: clientA.email }
    });
    expect(JSON.stringify(clientResponse.body)).not.toContain(clientB.name);
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
