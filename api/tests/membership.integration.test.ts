import request from "supertest";
import { addDays, addMonths } from "date-fns";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { MembershipService } from "../src/services/membership.service.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();

describe("Membership payments", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lets clients report a payment and lets admins confirm it to renew membership", async () => {
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    const client = await createUser({ email: "client@test.local", role: "CLIENT", monthlyStatus: "IMPAGADO" });
    await prisma.user.update({ where: { id: client.id }, data: { membershipExpiresAt: addDays(new Date(), -1) } });

    const report = await request(app)
      .post("/api/membership/payments")
      .set("Authorization", `Bearer ${signAccessToken({ userId: client.id, role: client.role })}`)
      .send({ amountCents: 4500, notes: "Bank transfer" });

    expect(report.status).toBe(201);
    expect(report.body.payment.status).toBe("PENDING_ADMIN_REVIEW");

    const pending = await request(app)
      .get("/api/membership/payments/pending")
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`);
    expect(pending.status).toBe(200);
    expect(pending.body).toHaveLength(1);

    const confirm = await request(app)
      .post(`/api/membership/payments/${report.body.payment.id}/confirm`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`)
      .send({ months: 1 });

    expect(confirm.status).toBe(200);
    expect(confirm.body.user.estado_mensualidad).toBe("PAGADO");
    expect(new Date(confirm.body.user.membership_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("expires only client memberships and notifies admins", async () => {
    const service = new MembershipService(prisma);
    const client = await createUser({ email: "client@test.local", role: "CLIENT", monthlyStatus: "PAGADO" });
    const teacher = await createUser({ email: "teacher@test.local", role: "TEACHER" });
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    await prisma.user.update({ where: { id: client.id }, data: { membershipExpiresAt: addDays(new Date(), -1) } });
    await prisma.user.updateMany({ where: { id: { in: [teacher.id, admin.id] } }, data: { membershipExpiresAt: addDays(new Date(), -1), monthlyStatus: "PAGADO" } });

    const result = await service.expireOverdueMemberships();

    expect(result.expired).toBe(1);
    await expect(prisma.user.findUniqueOrThrow({ where: { id: client.id } })).resolves.toMatchObject({ monthlyStatus: "IMPAGADO" });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: teacher.id } })).resolves.toMatchObject({ monthlyStatus: "PAGADO" });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).resolves.toMatchObject({ monthlyStatus: "PAGADO" });
    await expect(prisma.adminNotification.count({ where: { type: "MEMBERSHIP_EXPIRED", userId: client.id } })).resolves.toBe(1);
  });

  it("renews from the later of now or current expiry date", async () => {
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    const client = await createUser({ email: "client@test.local", role: "CLIENT", monthlyStatus: "PAGADO" });
    const currentExpiry = addMonths(new Date(), 1);
    await prisma.user.update({ where: { id: client.id }, data: { membershipExpiresAt: currentExpiry } });

    const response = await request(app)
      .post(`/api/membership/users/${client.id}/renew`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`)
      .send({ months: 1 });

    expect(response.status).toBe(200);
    expect(new Date(response.body.user.membership_expires_at).getTime()).toBeGreaterThan(addDays(currentExpiry, 25).getTime());
  });
});
