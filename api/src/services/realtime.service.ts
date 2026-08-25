import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "./token.service.js";

export type RealtimeScope =
  | "classes"
  | "users"
  | "membership"
  | "settings"
  | "images"
  | "classTypes"
  | "notifications"
  | "global";

type RealtimeClient = {
  socket: WebSocket;
  userId: number;
  role: "ADMIN" | "TEACHER" | "CLIENT";
  isAlive: boolean;
};

type RealtimeAuth = Pick<RealtimeClient, "userId" | "role">;

type DataChangedEvent = {
  type: "DATA_CHANGED";
  scope: RealtimeScope;
  version: number;
  actorUserId?: number;
};

const isRealtimePath = (request: IncomingMessage) => {
  try {
    return new URL(request.url ?? "", "http://localhost").pathname === "/api/realtime";
  } catch {
    return false;
  }
};

const AUTH_TIMEOUT_MS = 5_000;
const MAX_AUTH_MESSAGE_BYTES = 4_096;

type AuthenticationMessage = {
  type: "AUTH";
  token: string;
};

const parseAuthenticationMessage = (data: RawData, isBinary: boolean): AuthenticationMessage => {
  const bytes = Array.isArray(data)
    ? Buffer.concat(data)
    : Buffer.isBuffer(data)
      ? data
      : Buffer.from(new Uint8Array(data));
  if (isBinary || bytes.byteLength > MAX_AUTH_MESSAGE_BYTES) {
    throw new Error("Invalid authentication message");
  }

  const value: unknown = JSON.parse(bytes.toString("utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    (value as { type?: unknown }).type !== "AUTH" ||
    typeof (value as { token?: unknown }).token !== "string" ||
    !(value as { token: string }).token ||
    (value as { token: string }).token.length > MAX_AUTH_MESSAGE_BYTES
  ) {
    throw new Error("Invalid authentication message");
  }

  return value as AuthenticationMessage;
};

class RealtimeHub {
  private readonly clients = new Set<RealtimeClient>();
  private server?: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;

  attach(httpServer: HttpServer) {
    if (this.server) return;
    this.server = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (request, socket, head) => {
      if (!isRealtimePath(request)) return;

      this.server?.handleUpgrade(request, socket, head, (webSocket) => {
        this.authenticateClient(webSocket);
      });
    });

    this.heartbeat = setInterval(() => this.pingClients(), 30_000);
    this.heartbeat.unref?.();
  }

  broadcastDataChanged(scope: RealtimeScope = "global", actorUserId?: number) {
    const event: DataChangedEvent = {
      type: "DATA_CHANGED",
      scope,
      version: Date.now(),
      actorUserId
    };

    for (const client of this.clients) {
      this.send(client, event);
    }
  }

  close() {
    clearInterval(this.heartbeat);
    for (const client of this.clients) {
      client.socket.close();
    }
    this.clients.clear();
    this.server?.close();
    this.server = undefined;
  }

  private send(client: RealtimeClient, payload: unknown) {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.socket.send(JSON.stringify(payload));
  }

  private registerClient(socket: WebSocket, auth: RealtimeAuth) {
    const client: RealtimeClient = {
      socket,
      userId: auth.userId,
      role: auth.role,
      isAlive: true
    };
    this.clients.add(client);

    socket.on("pong", () => {
      client.isAlive = true;
    });

    socket.on("close", () => {
      this.clients.delete(client);
    });

    this.send(client, {
      type: "CONNECTED",
      version: Date.now()
    });
  }

  private authenticateClient(socket: WebSocket) {
    const timeout = setTimeout(() => {
      socket.close(1008, "Authentication required");
    }, AUTH_TIMEOUT_MS);
    timeout.unref?.();

    const fail = () => {
      clearTimeout(timeout);
      socket.close(1008, "Authentication failed");
    };

    socket.once("message", (data, isBinary) => {
      void (async () => {
        try {
          const message = parseAuthenticationMessage(data, isBinary);
          const tokenAuth = verifyAccessToken(message.token);
          const currentUser = await prisma.user.findUnique({
            where: { id: tokenAuth.userId },
            select: { id: true, role: true }
          });
          if (!currentUser) {
            fail();
            return;
          }

          clearTimeout(timeout);
          this.registerClient(socket, {
            userId: currentUser.id,
            role: currentUser.role
          });
        } catch {
          fail();
        }
      })();
    });

    socket.once("close", () => clearTimeout(timeout));
    socket.once("error", () => clearTimeout(timeout));
  }

  private pingClients() {
    for (const client of this.clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        this.clients.delete(client);
        continue;
      }

      client.isAlive = false;
      client.socket.ping();
    }
  }
}

export const realtimeHub = new RealtimeHub();

export function broadcastDataChanged(scope: RealtimeScope = "global", actorUserId?: number) {
  realtimeHub.broadcastDataChanged(scope, actorUserId);
}
