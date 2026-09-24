import path from "node:path";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { AppError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { realtimeBroadcast } from "./middleware/realtimeBroadcast.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminNotificationRouter } from "./routes/adminNotification.routes.js";
import { classRouter } from "./routes/class.routes.js";
import { classTypeRouter } from "./routes/classType.routes.js";
import { pushDeviceRouter } from "./routes/pushDevice.routes.js";
import { reservationRouter } from "./routes/reservation.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { settingsRouter } from "./routes/settings.routes.js";
import { imageBankRouter } from "./routes/imageBank.routes.js";
import { membershipRouter } from "./routes/membership.routes.js";

const publicRasterContentTypes = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

export function createApp() {
  const app = express();
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(realtimeBroadcast);
  app.use(express.json({ limit: "1mb" }));
  app.use(
    "/uploads",
    (req, _res, next) => {
      if (!publicRasterContentTypes.has(path.extname(req.path).toLowerCase())) {
        next(new AppError(404, "NOT_FOUND", "Route not found"));
        return;
      }
      next();
    },
    express.static(path.resolve(process.cwd(), "uploads"), {
      dotfiles: "ignore",
      setHeaders: (res, filePath) => {
        const contentType = publicRasterContentTypes.get(path.extname(filePath).toLowerCase());
        if (contentType) res.setHeader("Content-Type", contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    })
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/push-devices", pushDeviceRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/users", userRouter);
  app.use("/api/membership", membershipRouter);
  app.use("/api/admin-notifications", adminNotificationRouter);
  app.use("/api/image-bank", imageBankRouter);
  app.use("/api/class-types", classTypeRouter);
  app.use("/api/classes", classRouter);
  app.use("/api/classes", reservationRouter);

  app.use((_req, _res, next) => next(new AppError(404, "NOT_FOUND", "Route not found")));
  app.use(errorHandler);

  return app;
}
