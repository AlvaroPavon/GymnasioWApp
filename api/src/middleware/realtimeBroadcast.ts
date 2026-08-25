import type { NextFunction, Request, Response } from "express";
import { broadcastDataChanged, type RealtimeScope } from "../services/realtime.service.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function scopeFromPath(path: string): RealtimeScope {
  if (path.startsWith("/api/classes")) return "classes";
  if (path.startsWith("/api/users")) return "users";
  if (path.startsWith("/api/membership")) return "membership";
  if (path.startsWith("/api/settings")) return "settings";
  if (path.startsWith("/api/image-bank")) return "images";
  if (path.startsWith("/api/class-types")) return "classTypes";
  if (path.startsWith("/api/admin-notifications")) return "notifications";
  return "global";
}

export function realtimeBroadcast(req: Request, res: Response, next: NextFunction) {
  const requestPath = req.originalUrl.split("?")[0] || req.path;
  const shouldBroadcast = requestPath.startsWith("/api/")
    && MUTATING_METHODS.has(req.method)
    && requestPath !== "/api/realtime"
    && !requestPath.startsWith("/api/auth")
    && !requestPath.startsWith("/api/push-devices");

  if (shouldBroadcast) {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        broadcastDataChanged(scopeFromPath(requestPath), req.auth?.userId);
      }
    });
  }

  next();
}
