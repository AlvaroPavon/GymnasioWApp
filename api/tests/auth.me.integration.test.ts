import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();

describe("Current authenticated user", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the public user with the authoritative database role", async () => {
    const client = await createUser({
      email: "current-user@test.local",
      name: "Current User",
      role: "CLIENT"
    });
    const staleToken = signAccessToken({ userId: client.id, role: client.role });
    await prisma.user.update({
      where: { id: client.id },
      data: {
        role: "TEACHER",
        phone: "+34 600 123 456",
        profilePicture: "https://cdn.example.test/profile.jpg"
      }
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${staleToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: client.id,
      name: "Current User",
      email: client.email,
      role: "TEACHER",
      phone: "+34 600 123 456",
      profilePicture: "https://cdn.example.test/profile.jpg",
      profile_picture: "https://cdn.example.test/profile.jpg"
    });
    expect(response.body).toHaveProperty("monthlyStatus");
    expect(response.body).toHaveProperty("membershipExpiresAt");
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("requires a bearer token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects a token after its user is deleted", async () => {
    const user = await createUser({ email: "deleted-user@test.local", role: "CLIENT" });
    const token = signAccessToken({ userId: user.id, role: user.role });
    await prisma.user.delete({ where: { id: user.id } });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });
});
