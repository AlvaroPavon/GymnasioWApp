import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { publicUploadUrl, uploadSettings } from "../middleware/upload.js";

const router = Router();

const settingsBody = z.object({
  appName: z.string().trim().min(2).max(120).optional(),
  app_name: z.string().trim().min(2).max(120).optional(),
  heroImage: z.string().url().optional(),
  hero_image: z.string().url().optional()
}).passthrough();

function settingsDto(settings: { id: number; appName: string; heroImage: string | null; updatedAt: Date }) {
  return {
    id: settings.id,
    appName: settings.appName,
    app_name: settings.appName,
    heroImage: settings.heroImage,
    hero_image: settings.heroImage,
    updatedAt: settings.updatedAt,
    updated_at: settings.updatedAt
  };
}

async function ensureSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      appName: "Ronquillo Te Cuida",
      heroImage: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1400&q=80"
    }
  });
}

router.get("/", asyncHandler(async (_req, res) => {
  const settings = await ensureSettings();
  res.json(settingsDto(settings));
}));

router.put("/", authenticate, requireRoles("ADMIN"), uploadSettings.single("hero"), asyncHandler(async (req, res) => {
  const body = settingsBody.parse(req.body);
  const heroImage = publicUploadUrl(req.file) ?? body.heroImage ?? body.hero_image;
  const appName = body.appName ?? body.app_name;
  const settings = await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: { appName, heroImage },
    create: {
      id: 1,
      appName: appName ?? "Ronquillo Te Cuida",
      heroImage: heroImage ?? "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1400&q=80"
    }
  });
  res.json(settingsDto(settings));
}));

export { router as settingsRouter };
