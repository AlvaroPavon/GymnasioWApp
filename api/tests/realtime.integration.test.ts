import { createServer, type Server } from "node:http";
import request from "supertest";
import WebSocket from "ws";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { realtimeHub } from "../src/services/realtime.service.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createUser, resetDatabase } from "./helpers/database.js";

function listen(server: Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) resolve(address.port);
    });
  });
}

function waitForDataChanged(socket: WebSocket) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for realtime event")), 5000);

    socket.on("message", (raw) => {
      const event = JSON.parse(String(raw));
      if (event.type === "DATA_CHANGED") {
        clearTimeout(timeout);
        resolve(event);
      }
    });
  });
}

function waitForMessageType(socket: WebSocket, type: string) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000);
    socket.on("message", (raw) => {
      const event = JSON.parse(String(raw));
      if (event.type === type) {
        clearTimeout(timeout);
        resolve(event);
      }
    });
  });
}

async function connectAuthenticated(port: number, token: string) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime`);
  const connected = waitForMessageType(socket, "CONNECTED");
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "AUTH", token }));
      resolve();
    });
    socket.once("error", reject);
  });
  await connected;
  return socket;
}

describe("Realtime sync", () => {
  let server: Server;

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
    const app = createApp();
    server = createServer(app);
    realtimeHub.attach(server);
    await listen(server);
  });

  afterEach(async () => {
    realtimeHub.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("broadcasts a DATA_CHANGED event after successful mutations", async () => {
    const admin = await createUser({ email: "admin@test.local", role: "ADMIN" });
    const token = signAccessToken({ userId: admin.id, role: admin.role });
    const port = (server.address() as { port: number }).port;
    const socket = await connectAuthenticated(port, token);

    const eventPromise = waitForDataChanged(socket);

    const response = await request(server)
      .post("/api/class-types")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pilates" });

    expect(response.status).toBe(201);
    await expect(eventPromise).resolves.toMatchObject({
      type: "DATA_CHANGED",
      scope: "classTypes",
      actorUserId: admin.id
    });

    socket.close();
  });

  it("rejects malformed credentials without exposing the token in the URL", async () => {
    const port = (server.address() as { port: number }).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime`);
    const closed = new Promise<number>((resolve) => socket.once("close", resolve));
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => {
        expect(socket.url).not.toContain("token=");
        socket.send(JSON.stringify({ type: "AUTH", token: "invalid" }));
        resolve();
      });
      socket.once("error", reject);
    });
    await expect(closed).resolves.toBe(1008);
  });

  it("rejects a valid token after its user has been deleted", async () => {
    const user = await createUser({ email: "deleted-realtime@test.local", role: "TEACHER" });
    const token = signAccessToken({ userId: user.id, role: user.role });
    await prisma.user.delete({ where: { id: user.id } });
    const port = (server.address() as { port: number }).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime`);
    const closed = new Promise<number>((resolve) => socket.once("close", resolve));
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => {
        socket.send(JSON.stringify({ type: "AUTH", token }));
        resolve();
      });
      socket.once("error", reject);
    });
    await expect(closed).resolves.toBe(1008);
  });
});
