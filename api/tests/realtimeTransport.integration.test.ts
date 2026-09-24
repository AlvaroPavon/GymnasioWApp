import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { realtimeHub } from "../src/services/realtime.service.js";

function listen(server: Server) {
  return new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) resolve(address.port);
    });
  });
}

describe("Realtime transport security", () => {
  let server: Server;

  beforeEach(async () => {
    server = createServer();
    realtimeHub.attach(server);
    await listen(server);
  });

  afterEach(async () => {
    realtimeHub.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("rejects an oversized authentication frame at the WebSocket transport boundary", async () => {
    const port = (server.address() as { port: number }).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime`);
    const closed = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for oversized frame rejection")), 5000);
      socket.once("close", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => {
        socket.send("x".repeat(4_097));
        resolve();
      });
      socket.once("error", reject);
    });

    await expect(closed).resolves.toBe(1009);
  });
});
