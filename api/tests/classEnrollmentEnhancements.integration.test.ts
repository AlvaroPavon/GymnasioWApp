import request from "supertest";
import { addDays, addWeeks } from "date-fns";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createGymClass, createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();
const authorizationFor = (user: { id: number; role: "ADMIN" | "TEACHER" | "CLIENT" }) =>
  `Bearer ${signAccessToken({ userId: user.id, role: user.role })}`;

describe("Class enrollment enhancements", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("hides an opted-in attendee only from other clients", async () => {
    const teacher = await createUser({ email: "privacy-teacher@test.local", role: "TEACHER" });
    const hiddenClient = await createUser({ email: "hidden@test.local", name: "Persona Privada" });
    const viewerClient = await createUser({ email: "viewer@test.local", name: "Persona Visible" });
    const { gymClass } = await createGymClass({
      teacherId: teacher.id,
      capacity: 4,
      startsAt: addDays(new Date(), 2)
    });

    const hiddenReserve = await request(app)
      .post(`/api/classes/${gymClass.id}/reserve`)
      .set("Authorization", authorizationFor(hiddenClient))
      .send({ hideName: true });
    const visibleReserve = await request(app)
      .post(`/api/classes/${gymClass.id}/reserve`)
      .set("Authorization", authorizationFor(viewerClient))
      .send({ hideName: false });
    expect(hiddenReserve.status).toBe(201);
    expect(visibleReserve.status).toBe(201);

    const clientView = await request(app)
      .get("/api/classes")
      .set("Authorization", authorizationFor(viewerClient));
    expect(clientView.status).toBe(200);
    const hiddenReservation = clientView.body[0].reservations.find(
      (reservation: { user?: { name?: string } }) => reservation.user?.name === "Usuario anónimo"
    );
    expect(hiddenReservation).toMatchObject({
      userId: null,
      hideName: true,
      user: { id: null, name: "Usuario anónimo" }
    });
    expect(JSON.stringify(hiddenReservation)).not.toContain(hiddenClient.email);
    expect(JSON.stringify(hiddenReservation)).not.toContain(hiddenClient.name);

    const teacherView = await request(app)
      .get("/api/classes")
      .set("Authorization", authorizationFor(teacher));
    expect(teacherView.status).toBe(200);
    expect(teacherView.body[0].reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: hiddenClient.id,
        hideName: true,
        user: expect.objectContaining({ name: hiddenClient.name, email: hiddenClient.email })
      })
    ]));

    const privacyUpdate = await request(app)
      .patch(`/api/classes/${gymClass.id}/reservations/privacy`)
      .set("Authorization", authorizationFor(hiddenClient))
      .send({ hideName: false });
    expect(privacyUpdate.status).toBe(200);

    const visibleAfterUpdate = await request(app)
      .get("/api/classes")
      .set("Authorization", authorizationFor(viewerClient));
    expect(visibleAfterUpdate.body[0].reservations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: hiddenClient.id,
        hideName: false,
        user: expect.objectContaining({ name: hiddenClient.name })
      })
    ]));
    expect(JSON.stringify(visibleAfterUpdate.body[0].reservations)).not.toContain(hiddenClient.email);
  });

  it("creates a weekly series and confirms eligible fixed users in every occurrence", async () => {
    const admin = await createUser({ email: "series-admin@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "series-teacher@test.local", role: "TEACHER" });
    const fixedA = await createUser({ email: "fixed-a@test.local", name: "Fija Uno" });
    const fixedB = await createUser({ email: "fixed-b@test.local", name: "Fijo Dos" });
    const startsAt = addDays(new Date(), 3);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const response = await request(app)
      .post("/api/classes")
      .set("Authorization", authorizationFor(admin))
      .send({
        title: "Yoga semanal",
        teacherId: teacher.id,
        maxCapacity: 4,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        repeatWeeks: 3,
        fixedUserIds: [fixedA.id, fixedB.id]
      });

    expect(response.status).toBe(201);
    expect(response.body.createdCount).toBe(3);
    expect(response.body.series).toHaveLength(3);
    expect(response.body.series.map((item: { startsAt: string }) => new Date(item.startsAt))).toEqual([
      startsAt,
      addWeeks(startsAt, 1),
      addWeeks(startsAt, 2)
    ]);

    const classes = await prisma.gymClass.findMany({
      where: { title: "Yoga semanal" },
      orderBy: { startsAt: "asc" },
      include: { reservations: { orderBy: { userId: "asc" } } }
    });
    expect(classes).toHaveLength(3);
    for (const gymClass of classes) {
      expect(gymClass.reservations).toHaveLength(2);
      expect(gymClass.reservations).toEqual(expect.arrayContaining([
        expect.objectContaining({ userId: fixedA.id, status: "CONFIRMADA", fixedEnrollment: true }),
        expect.objectContaining({ userId: fixedB.id, status: "CONFIRMADA", fixedEnrollment: true })
      ]));
    }
  });

  it("rejects ineligible fixed clients and exposes only eligible clients to staff", async () => {
    const teacher = await createUser({ email: "eligible-teacher@test.local", role: "TEACHER" });
    const paid = await createUser({ email: "eligible@test.local" });
    const unpaid = await createUser({ email: "unpaid@test.local", monthlyStatus: "IMPAGADO" });
    const startsAt = addDays(new Date(), 3);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

    const eligibleResponse = await request(app)
      .get("/api/users/eligible-clients")
      .set("Authorization", authorizationFor(teacher));
    expect(eligibleResponse.status).toBe(200);
    expect(eligibleResponse.body.map((user: { id: number }) => user.id)).toEqual([paid.id]);

    const createResponse = await request(app)
      .post("/api/classes")
      .set("Authorization", authorizationFor(teacher))
      .send({
        title: "Pilates fijo",
        maxCapacity: 2,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        fixedUserIds: [unpaid.id]
      });
    expect(createResponse.status).toBe(409);
    expect(createResponse.body.error?.code ?? createResponse.body.code).toBe("FIXED_USER_NOT_ELIGIBLE");
    await expect(prisma.gymClass.count({ where: { title: "Pilates fijo" } })).resolves.toBe(0);
  });

  it("rejects malformed class date-times before Prisma receives them", async () => {
    const teacher = await createUser({ email: "invalid-date-teacher@test.local", role: "TEACHER" });
    const response = await request(app)
      .post("/api/classes")
      .set("Authorization", authorizationFor(teacher))
      .send({
        title: "Clase con fecha inválida",
        maxCapacity: 8,
        startsAt: "not-a-valid-date",
        endsAt: "2026-10-01T11:00:00.000Z"
      });

    expect(response.status).toBe(400);
    expect(response.body.error?.code ?? response.body.code).toBe("VALIDATION_ERROR");
    await expect(prisma.gymClass.count({ where: { title: "Clase con fecha inválida" } })).resolves.toBe(0);
  });

  it("updates the authenticated user's one-hour reminder preference", async () => {
    const client = await createUser({ email: "preferences@test.local" });
    const response = await request(app)
      .patch("/api/users/me/preferences")
      .set("Authorization", authorizationFor(client))
      .send({ classReminderEnabled: true });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: client.id,
      classReminderEnabled: true,
      class_reminder_enabled: true
    });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: client.id } }))
      .resolves.toMatchObject({ classReminderEnabled: true });
  });
});
