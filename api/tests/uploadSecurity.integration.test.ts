import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { AppError } from "../src/errors/AppError.js";
import { asyncHandler } from "../src/middleware/asyncHandler.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import {
  persistClassTypeImage,
  uploadClassTypeImage,
  uploadProfile,
  uploadSettings,
  withPersistedHeroImage,
  withPersistedProfileImage
} from "../src/middleware/upload.js";

const uploadApp = express();
uploadApp.post(
  "/profile",
  uploadProfile.single("profile"),
  asyncHandler(async (req, res) => {
    const imageUrl = await withPersistedProfileImage(req.file, async (url) => url);
    res.status(201).json({ imageUrl });
  })
);
uploadApp.post(
  "/hero",
  uploadSettings.single("hero"),
  asyncHandler(async (req, res) => {
    const imageUrl = await withPersistedHeroImage(req.file, async (url) => url);
    res.status(201).json({ imageUrl });
  })
);
uploadApp.post(
  "/class-type",
  uploadClassTypeImage.single("image"),
  asyncHandler(async (req, res) => {
    const imageUrl = req.file ? await persistClassTypeImage(req.file) : undefined;
    res.status(201).json({ imageUrl });
  })
);
uploadApp.post(
  "/profile-failure",
  uploadProfile.single("profile"),
  asyncHandler(async (req, res) => {
    await withPersistedProfileImage(req.file, async () => {
      throw new AppError(422, "OWNER_MUTATION_FAILED", "Owner mutation failed");
    });
    res.sendStatus(204);
  })
);
uploadApp.use(errorHandler);

const staticApp = createApp();
const createdFiles = new Set<string>();
let jpegPolyglot: Buffer;
let tinyPng: Buffer;

function localPathFromUrl(imageUrl: string) {
  return path.resolve(process.cwd(), imageUrl.replace(/^\/uploads\//, "uploads/"));
}

async function filenames(folder: string) {
  try {
    return (await fs.promises.readdir(path.resolve(process.cwd(), "uploads", folder))).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

describe("Upload transport security", () => {
  beforeAll(async () => {
    const source = sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#ff0000"
      }
    });
    const jpeg = await source.jpeg().toBuffer();
    jpegPolyglot = Buffer.concat([jpeg, Buffer.from("<script>alert('xss')</script>")]);
    tinyPng = await source.png().toBuffer();
  });

  afterEach(async () => {
    await Promise.all([...createdFiles].map(async (file) => {
      await fs.promises.unlink(file).catch(() => undefined);
      createdFiles.delete(file);
    }));
  });

  it.each([
    ["profile", "profile", "profiles"],
    ["hero", "hero", "settings"],
    ["class-type", "image", "class-types"]
  ])("decodes and re-encodes %s polyglots as metadata-free WebP", async (route, field, folder) => {
    const response = await request(uploadApp)
      .post(`/${route}`)
      .attach(field, jpegPolyglot, { filename: "active.html", contentType: "image/jpeg" });

    expect(response.status).toBe(201);
    expect(response.body.imageUrl).toMatch(new RegExp(`^/uploads/${folder}/[a-f0-9-]+\\.webp$`));
    const localFile = localPathFromUrl(response.body.imageUrl);
    createdFiles.add(localFile);

    const normalized = await fs.promises.readFile(localFile);
    const metadata = await sharp(normalized).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
    expect(normalized.includes(Buffer.from("<script>"))).toBe(false);

    const served = await request(staticApp).get(response.body.imageUrl);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toMatch(/^image\/webp/);
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
  });

  it.each([
    ["profile", "profile", "profiles"],
    ["hero", "hero", "settings"],
    ["class-type", "image", "class-types"]
  ])("rejects spoofed MIME for %s without writing a file", async (route, field, folder) => {
    const before = await filenames(folder);
    const response = await request(uploadApp)
      .post(`/${route}`)
      .attach(field, tinyPng, { filename: "spoofed.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_IMAGE_CONTENT");
    await expect(filenames(folder)).resolves.toEqual(before);
  });

  it("rejects SVG declarations and HTML bytes disguised as a supported raster", async () => {
    const svg = await request(uploadApp)
      .post("/profile")
      .attach("profile", Buffer.from("<svg><script>alert(1)</script></svg>"), {
        filename: "active.svg",
        contentType: "image/svg+xml"
      });
    expect(svg.status).toBe(400);
    expect(svg.body.error.code).toBe("INVALID_IMAGE_TYPE");

    const html = await request(uploadApp)
      .post("/hero")
      .attach("hero", Buffer.from("<!doctype html><script>alert(1)</script>"), {
        filename: "active.png",
        contentType: "image/png"
      });
    expect(html.status).toBe(400);
    expect(html.body.error.code).toBe("INVALID_IMAGE_CONTENT");
  });

  it("removes a normalized upload when its owning mutation fails", async () => {
    const before = await filenames("profiles");
    const response = await request(uploadApp)
      .post("/profile-failure")
      .attach("profile", jpegPolyglot, { filename: "profile.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("OWNER_MUTATION_FAILED");
    await expect(filenames("profiles")).resolves.toEqual(before);
  });

  it("does not serve active-content extensions from the public upload origin", async () => {
    const localFile = path.resolve(process.cwd(), "uploads", "profiles", `${crypto.randomUUID()}.html`);
    await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
    await fs.promises.writeFile(localFile, "<script>alert(1)</script>");
    createdFiles.add(localFile);

    const response = await request(staticApp).get(`/uploads/profiles/${path.basename(localFile)}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("continues serving packaged raster defaults with a fixed content type", async () => {
    const response = await request(staticApp).get("/uploads/class-types/pilates.jpg");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
