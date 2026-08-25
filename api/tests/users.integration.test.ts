import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();

describe("User administration", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lets admins reset another user's password without exposing the hash", async () => {
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    const client = await createUser({ email: "client@test.local", role: "CLIENT" });

    const response = await request(app)
      .put(`/api/users/${client.id}/password`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: admin.id, role: admin.role })}`)
      .send({ password: "NewPassword123!" });

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(client.email);
    expect(response.body.passwordHash).toBeUndefined();

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: client.email, password: "Password123!" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: client.email, password: "NewPassword123!" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.id).toBe(client.id);
  });

  it("blocks non-admin users from resetting passwords", async () => {
    const client = await createUser({ email: "client@test.local", role: "CLIENT" });
    const target = await createUser({ email: "target@test.local", role: "CLIENT" });

    const response = await request(app)
      .put(`/api/users/${target.id}/password`)
      .set("Authorization", `Bearer ${signAccessToken({ userId: client.id, role: client.role })}`)
      .send({ password: "NewPassword123!" });

    expect(response.status).toBe(403);
  });

  it("uses the user's current database role instead of a stale admin token role", async () => {
    const admin = await createUser({ email: "demoted-admin@test.local", role: "ADMIN" });
    const token = signAccessToken({ userId: admin.id, role: admin.role });
    await prisma.user.update({ where: { id: admin.id }, data: { role: "CLIENT" } });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("honors a current admin role even when the token contains the previous client role", async () => {
    const client = await createUser({ email: "promoted-client@test.local", role: "CLIENT" });
    const token = signAccessToken({ userId: client.id, role: client.role });
    await prisma.user.update({ where: { id: client.id }, data: { role: "ADMIN" } });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("rejects a valid token after its user has been deleted", async () => {
    const admin = await createUser({ email: "deleted-admin@test.local", role: "ADMIN" });
    const token = signAccessToken({ userId: admin.id, role: admin.role });
    await prisma.user.delete({ where: { id: admin.id } });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });
});
