import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import {
  uploadClassTypeImage,
  uploadFileSizeLimits,
  uploadProfile,
  uploadSettings
} from "../src/middleware/upload.js";

function createUploadLimitApp() {
  const app = express();
  app.post("/profile", uploadProfile.single("profile"), (_req, res) => res.sendStatus(204));
  app.post("/hero", uploadSettings.single("hero"), (_req, res) => res.sendStatus(204));
  app.post("/class-type", uploadClassTypeImage.single("image"), (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  return app;
}

describe("Upload limit errors", () => {
  const app = createUploadLimitApp();

  it.each([
    ["profile", "profile", uploadFileSizeLimits.profile, 2],
    ["hero", "hero", uploadFileSizeLimits.hero, 3],
    ["class-type", "image", uploadFileSizeLimits.image, 4]
  ])("reports the actual %s route limit", async (route, field, limit, megabytes) => {
    const response = await request(app)
      .post(`/${route}`)
      .attach(field, Buffer.alloc(limit + 1), { filename: "oversized.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: "IMAGE_TOO_LARGE",
      message: `La imagen supera el límite de ${megabytes} MB.`
    });
  });
});
