import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import request from "supertest";
import { addMinutes } from "date-fns";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { env, parseEnv } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { signAccessToken } from "../src/services/token.service.js";
import { createUser, resetDatabase } from "./helpers/database.js";

const app = createApp();
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64"
);
const createdFiles = new Set<string>();

function tokenFor(user: { id: number; role: "ADMIN" | "TEACHER" | "CLIENT" }) {
  return signAccessToken({ userId: user.id, role: user.role });
}

function localPathFromUrl(imageUrl: string) {
  const pathname = new URL(imageUrl, "http://local.invalid").pathname;
  return path.resolve(process.cwd(), pathname.replace(/^\/uploads\//, "uploads/"));
}

async function createGeneratedClassTypeUpload() {
  const imageUrl = `/uploads/class-types/${crypto.randomUUID()}.webp`;
  const localFile = localPathFromUrl(imageUrl);
  await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
  await fs.promises.writeFile(localFile, tinyPng);
  createdFiles.add(localFile);
  return { imageUrl, localFile };
}

describe("Class type images", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await Promise.all([...createdFiles].map(async (file) => {
      await fs.promises.unlink(file).catch(() => undefined);
      createdFiles.delete(file);
    }));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks non-admin class-type image uploads", async () => {
    const client = await createUser({ email: "client-image@test.local", role: "CLIENT" });
    const classType = await prisma.classType.create({ data: { name: "Yoga" } });

    const response = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", `Bearer ${tokenFor(client)}`)
      .attach("image", tinyPng, { filename: "yoga.png", contentType: "image/png" });

    expect(response.status).toBe(403);
    await expect(prisma.classType.findUniqueOrThrow({ where: { id: classType.id } }))
      .resolves.toMatchObject({ imageUrl: null });
  });

  it("rejects unsupported types and malformed signature-prefixed image content", async () => {
    const admin = await createUser({ email: "admin-image@test.local", role: "ADMIN" });
    const classType = await prisma.classType.create({ data: { name: "Pilates" } });
    const authorization = `Bearer ${tokenFor(admin)}`;

    const unsupported = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", authorization)
      .attach("image", Buffer.from("plain text"), { filename: "image.txt", contentType: "text/plain" });
    expect(unsupported.status).toBe(400);
    expect(unsupported.body.error.code).toBe("INVALID_IMAGE_TYPE");

    const malformedPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("not a decodable png")
    ]);
    const spoofed = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", authorization)
      .attach("image", malformedPng, { filename: "fake.png", contentType: "image/png" });
    expect(spoofed.status).toBe(400);
    expect(spoofed.body.error.code).toBe("INVALID_IMAGE_CONTENT");
  });

  it("rejects decoded images beyond the configured dimension limit", async () => {
    const admin = await createUser({ email: "admin-dimensions@test.local", role: "ADMIN" });
    const classType = await prisma.classType.create({ data: { name: "Mobility" } });
    const oversized = await sharp({
      create: {
        width: 8_193,
        height: 1,
        channels: 3,
        background: "#000000"
      }
    }).png().toBuffer();

    const response = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .attach("image", oversized, { filename: "oversized.png", contentType: "image/png" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("IMAGE_DIMENSIONS_TOO_LARGE");
  });

  it("assigns an uploaded image and safely removes a replaced local file", async () => {
    const admin = await createUser({ email: "admin-replace@test.local", role: "ADMIN" });
    const classType = await prisma.classType.create({ data: { name: "Entrenamiento funcional" } });
    const authorization = `Bearer ${tokenFor(admin)}`;

    const first = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", authorization)
      .set("Host", "api.test")
      .attach("image", tinyPng, { filename: "functional.png", contentType: "image/png" });
    expect(first.status).toBe(200);
    expect(first.body.image_url).toMatch(/^http:\/\/api\.test\/uploads\/class-types\/[a-f0-9-]+\.webp$/);

    const stored = await prisma.classType.findUniqueOrThrow({ where: { id: classType.id } });
    expect(stored.imageUrl).toMatch(/^\/uploads\/class-types\/[a-f0-9-]+\.webp$/);
    const firstFile = localPathFromUrl(stored.imageUrl!);
    createdFiles.add(firstFile);
    expect(fs.existsSync(firstFile)).toBe(true);
    const normalizedMetadata = await sharp(await fs.promises.readFile(firstFile)).metadata();
    expect(normalizedMetadata.format).toBe("webp");
    expect(normalizedMetadata.exif).toBeUndefined();
    expect(normalizedMetadata.xmp).toBeUndefined();
    expect(normalizedMetadata.iptc).toBeUndefined();

    const replacement = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", authorization)
      .send({ image_url: "https://cdn.example.test/functional.webp" });
    expect(replacement.status).toBe(200);
    expect(replacement.body.image_url).toBe("https://cdn.example.test/functional.webp");

    expect(fs.existsSync(firstFile)).toBe(false);
    createdFiles.delete(firstFile);
  });

  it("clears an image and removes the generated upload only after it becomes orphaned", async () => {
    const admin = await createUser({ email: "admin-clear@test.local", role: "ADMIN" });
    const generated = await createGeneratedClassTypeUpload();
    const classType = await prisma.classType.create({
      data: { name: "Clear generated image", imageUrl: generated.imageUrl }
    });

    const response = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ image_url: null });

    expect(response.status).toBe(200);
    expect(response.body.image_url).toBeNull();
    expect(fs.existsSync(generated.localFile)).toBe(false);
    createdFiles.delete(generated.localFile);
  });

  it("preserves generated uploads referenced by any other image-bearing row", async () => {
    const admin = await createUser({ email: "admin-shared@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "teacher-shared@test.local", role: "TEACHER" });
    const authorization = `Bearer ${tokenFor(admin)}`;
    const [classTypeShared, classShared, bankShared, userShared, settingsShared] = await Promise.all([
      createGeneratedClassTypeUpload(),
      createGeneratedClassTypeUpload(),
      createGeneratedClassTypeUpload(),
      createGeneratedClassTypeUpload(),
      createGeneratedClassTypeUpload()
    ]);
    const owners = await Promise.all([
      prisma.classType.create({ data: { name: "Owner class type", imageUrl: classTypeShared.imageUrl } }),
      prisma.classType.create({ data: { name: "Owner class", imageUrl: classShared.imageUrl } }),
      prisma.classType.create({ data: { name: "Owner bank", imageUrl: bankShared.imageUrl } }),
      prisma.classType.create({ data: { name: "Owner user", imageUrl: userShared.imageUrl } }),
      prisma.classType.create({ data: { name: "Owner settings", imageUrl: settingsShared.imageUrl } })
    ]);
    const supportingType = await prisma.classType.create({ data: { name: "Supporting type" } });
    const startsAt = addMinutes(new Date(), 120);

    await Promise.all([
      prisma.classType.create({ data: { name: "Shared class type", imageUrl: classTypeShared.imageUrl } }),
      prisma.gymClass.create({
        data: {
          title: "Shared class override",
          classTypeId: supportingType.id,
          teacherId: teacher.id,
          maxCapacity: 10,
          startsAt,
          endsAt: addMinutes(startsAt, 60),
          imageUrl: classShared.imageUrl
        }
      }),
      prisma.imageBank.create({ data: { keyword: "shared-bank", imageUrl: bankShared.imageUrl } }),
      prisma.user.update({ where: { id: admin.id }, data: { profilePicture: userShared.imageUrl } }),
      prisma.systemSettings.create({ data: { id: 1, heroImage: settingsShared.imageUrl } })
    ]);

    for (const owner of owners) {
      const response = await request(app)
        .put(`/api/class-types/${owner.id}`)
        .set("Authorization", authorization)
        .send({ image_url: null });
      expect(response.status).toBe(200);
    }

    for (const shared of [classTypeShared, classShared, bankShared, userShared, settingsShared]) {
      expect(fs.existsSync(shared.localFile)).toBe(true);
    }
  });

  it("never deletes a packaged class-type default", async () => {
    const admin = await createUser({ email: "admin-packaged@test.local", role: "ADMIN" });
    const packagedImageUrl = "/uploads/class-types/pilates.jpg";
    const packagedFile = localPathFromUrl(packagedImageUrl);
    expect(fs.existsSync(packagedFile)).toBe(true);
    const classType = await prisma.classType.create({
      data: { name: "Packaged Pilates", imageUrl: packagedImageUrl }
    });

    const renamed = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Host", "api.test")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ name: "Packaged Pilates renamed" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.image_url).toBe("http://api.test/uploads/class-types/pilates.jpg");
    expect(fs.existsSync(packagedFile)).toBe(true);

    const response = await request(app)
      .put(`/api/class-types/${classType.id}`)
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ image_url: null });

    expect(response.status).toBe(200);
    expect(fs.existsSync(packagedFile)).toBe(true);
  });

  it("never maps arbitrary external origins to local files but cleans URLs on the configured public origin", async () => {
    const admin = await createUser({ email: "admin-origin-cleanup@test.local", role: "ADMIN" });
    const filename = `${crypto.randomUUID()}.webp`;
    const localFile = path.resolve(process.cwd(), "uploads/class-types", filename);
    await fs.promises.mkdir(path.dirname(localFile), { recursive: true });
    await fs.promises.writeFile(localFile, tinyPng);
    createdFiles.add(localFile);

    const classType = await prisma.classType.create({
      data: {
        name: "Origin cleanup",
        imageUrl: `https://public.example.test.evil/uploads/class-types/${filename}`
      }
    });
    const authorization = `Bearer ${tokenFor(admin)}`;
    const originalPublicBaseUrl = env.PUBLIC_BASE_URL;

    try {
      env.PUBLIC_BASE_URL = "https://public.example.test/api";

      const externalReplacement = await request(app)
        .put(`/api/class-types/${classType.id}`)
        .set("Authorization", authorization)
        .send({ image_url: "https://cdn.example.test/replacement.webp" });
      expect(externalReplacement.status).toBe(200);
      expect(fs.existsSync(localFile)).toBe(true);

      await prisma.classType.update({
        where: { id: classType.id },
        data: { imageUrl: `https://public.example.test/uploads/class-types/${filename}` }
      });
      const trustedReplacement = await request(app)
        .put(`/api/class-types/${classType.id}`)
        .set("Authorization", authorization)
        .send({ image_url: "https://cdn.example.test/final.webp" });
      expect(trustedReplacement.status).toBe(200);
      expect(fs.existsSync(localFile)).toBe(false);
      createdFiles.delete(localFile);
    } finally {
      env.PUBLIC_BASE_URL = originalPublicBaseUrl;
    }
  });

  it("uses only http/https configured public base URLs", () => {
    const baseEnv = {
      ...process.env,
      DATABASE_URL: "mysql://user:password@localhost:3306/database",
      JWT_SECRET: "a-test-secret-with-at-least-32-characters"
    };

    expect(parseEnv({ ...baseEnv, PUBLIC_BASE_URL: "https://api.example.test" }).PUBLIC_BASE_URL)
      .toBe("https://api.example.test");
    expect(() => parseEnv({ ...baseEnv, PUBLIC_BASE_URL: "ftp://api.example.test" }))
      .toThrow("PUBLIC_BASE_URL must use http or https");
  });

  it("uses configured origin and honors forwarded origin only for a trusted proxy", async () => {
    const client = await createUser({ email: "client-public-url@test.local", role: "CLIENT" });
    const classType = await prisma.classType.create({ data: { name: "Stretching", imageUrl: "/uploads/class-types/stretching.webp" } });
    const startsAt = addMinutes(new Date(), 120);
    await prisma.gymClass.create({
      data: {
        title: "Stretching",
        classTypeId: classType.id,
        teacherId: (await createUser({ email: "teacher-public-url@test.local", role: "TEACHER" })).id,
        maxCapacity: 10,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const authorization = `Bearer ${tokenFor(client)}`;
    const originalPublicBaseUrl = env.PUBLIC_BASE_URL;

    try {
      env.PUBLIC_BASE_URL = "https://configured.example.test/some/path";
      const configured = await request(app)
        .get("/api/classes")
        .set("Host", "untrusted.example.test")
        .set("Authorization", authorization);
      expect(configured.body[0].image_url).toBe("https://configured.example.test/uploads/class-types/stretching.webp");

      env.PUBLIC_BASE_URL = undefined;
      const untrusted = await request(app)
        .get("/api/classes")
        .set("Host", "nginx.internal")
        .set("X-Forwarded-Host", "public.example.test")
        .set("X-Forwarded-Proto", "https")
        .set("Authorization", authorization);
      expect(untrusted.body[0].image_url).toBe("http://nginx.internal/uploads/class-types/stretching.webp");

      const trustedProxyApp = createApp();
      trustedProxyApp.set("trust proxy", 1);
      const trusted = await request(trustedProxyApp)
        .get("/api/classes")
        .set("Host", "nginx.internal")
        .set("X-Forwarded-Host", "public.example.test")
        .set("X-Forwarded-Proto", "https")
        .set("Authorization", authorization);
      expect(trusted.body[0].image_url).toBe("https://public.example.test/uploads/class-types/stretching.webp");
    } finally {
      env.PUBLIC_BASE_URL = originalPublicBaseUrl;
    }
  });

  it("uses an admin-uploaded named type image for General rows in GET, POST and PUT responses", async () => {
    const admin = await createUser({ email: "admin-title-image@test.local", role: "ADMIN" });
    const teacher = await createUser({ email: "teacher-title-image@test.local", role: "TEACHER" });
    const client = await createUser({ email: "client-title-image@test.local", role: "CLIENT" });
    const general = await prisma.classType.create({ data: { name: "General" } });
    const pilates = await prisma.classType.create({ data: { name: "Pilates" } });
    await prisma.classType.create({
      data: { name: "Entrenamiento funcional", imageUrl: "https://cdn.example.test/functional.webp" }
    });
    const startsAt = addMinutes(new Date(), 120);
    const historicClass = await prisma.gymClass.create({
      data: {
        title: "PILATES suelo",
        classTypeId: general.id,
        teacherId: teacher.id,
        maxCapacity: 12,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const adminAuthorization = `Bearer ${tokenFor(admin)}`;

    const upload = await request(app)
      .put(`/api/class-types/${pilates.id}`)
      .set("Host", "api.test")
      .set("Authorization", adminAuthorization)
      .attach("image", tinyPng, { filename: "pilates.png", contentType: "image/png" });
    expect(upload.status).toBe(200);
    const storedPilates = await prisma.classType.findUniqueOrThrow({ where: { id: pilates.id } });
    createdFiles.add(localPathFromUrl(storedPilates.imageUrl!));

    const listed = await request(app)
      .get("/api/classes")
      .set("Host", "api.test")
      .set("Authorization", `Bearer ${tokenFor(client)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.find((gymClass: { id: number }) => gymClass.id === historicClass.id)).toMatchObject({
      image_url: upload.body.image_url,
      image_override_url: null,
      tipo_clase_id: general.id
    });

    const created = await request(app)
      .post("/api/classes")
      .set("Host", "api.test")
      .set("Authorization", adminAuthorization)
      .send({
        title: "Pilates reformer",
        teacherId: teacher.id,
        maxCapacity: 10,
        startsAt: addMinutes(startsAt, 120).toISOString(),
        endsAt: addMinutes(startsAt, 180).toISOString()
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      image_url: upload.body.image_url,
      image_override_url: null,
      tipo_clase_id: general.id
    });

    const updated = await request(app)
      .put(`/api/classes/${created.body.id}`)
      .set("Host", "api.test")
      .set("Authorization", adminAuthorization)
      .send({ title: "Functional fuerza" });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      image_url: "https://cdn.example.test/functional.webp",
      image_override_url: null,
      tipo_clase_id: general.id
    });

    await expect(prisma.gymClass.findMany({
      where: { id: { in: [historicClass.id, created.body.id] } },
      select: { id: true, classTypeId: true, imageUrl: true },
      orderBy: { id: "asc" }
    })).resolves.toEqual([
      { id: historicClass.id, classTypeId: general.id, imageUrl: null },
      { id: created.body.id, classTypeId: general.id, imageUrl: null }
    ]);
  });

  it("returns effective absolute images in override, type and legacy order", async () => {
    const teacher = await createUser({ email: "teacher-images@test.local", role: "TEACHER" });
    const client = await createUser({ email: "client-images@test.local", role: "CLIENT" });
    const yoga = await prisma.classType.create({ data: { name: "Yoga", imageUrl: "/uploads/class-types/yoga.jpg" } });
    const general = await prisma.classType.create({ data: { name: "General" } });
    await prisma.imageBank.create({ data: { keyword: "cardio", imageUrl: "https://legacy.example.test/cardio.jpg" } });
    const startsAt = addMinutes(new Date(), 120);

    const typedClass = await prisma.gymClass.create({
      data: {
        title: "Yoga suave",
        classTypeId: yoga.id,
        teacherId: teacher.id,
        maxCapacity: 12,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const legacyClass = await prisma.gymClass.create({
      data: {
        title: "Cardio legacy flow",
        classTypeId: general.id,
        teacherId: teacher.id,
        maxCapacity: 12,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const overrideClass = await prisma.gymClass.create({
      data: {
        title: "Yoga personalizada",
        classTypeId: yoga.id,
        teacherId: teacher.id,
        maxCapacity: 12,
        startsAt,
        endsAt: addMinutes(startsAt, 60),
        imageUrl: "https://override.example.test/yoga.jpg"
      }
    });

    const response = await request(app)
      .get("/api/classes")
      .set("Host", "api.test")
      .set("Authorization", `Bearer ${tokenFor(client)}`);

    expect(response.status).toBe(200);
    const byId = new Map<number, any>(response.body.map((gymClass: { id: number }) => [gymClass.id, gymClass]));
    expect(byId.get(typedClass.id).image_url).toBe("http://api.test/uploads/class-types/yoga.jpg");
    expect(byId.get(typedClass.id).image_override_url).toBeNull();
    expect(byId.get(typedClass.id).classType.image_url).toBe("http://api.test/uploads/class-types/yoga.jpg");
    expect(byId.get(legacyClass.id).image_url).toBe("https://legacy.example.test/cardio.jpg");
    expect(byId.get(overrideClass.id).image_url).toBe("https://override.example.test/yoga.jpg");
    expect(byId.get(overrideClass.id).image_override_url).toBe("https://override.example.test/yoga.jpg");

    const typedDto = byId.get(typedClass.id);
    const unrelatedEdit = await request(app)
      .put(`/api/classes/${typedClass.id}`)
      .set("Host", "api.test")
      .set("Authorization", `Bearer ${tokenFor(teacher)}`)
      .send({
        title: "Yoga suave actualizada",
        imageUrl: typedDto.imageUrl,
        image_url: typedDto.image_url
      });

    expect(unrelatedEdit.status).toBe(200);
    expect(unrelatedEdit.body.image_url).toBe("http://api.test/uploads/class-types/yoga.jpg");
    expect(unrelatedEdit.body.image_override_url).toBeNull();
    await expect(prisma.gymClass.findUniqueOrThrow({ where: { id: typedClass.id } }))
      .resolves.toMatchObject({ title: "Yoga suave actualizada", imageUrl: null });
  });

  it("loads named type and legacy candidates once per GET, POST and PUT request", async () => {
    const admin = await createUser({ email: "admin-candidate-count@test.local", role: "ADMIN" });
    const client = await createUser({ email: "client-candidate-count@test.local", role: "CLIENT" });
    const teacher = await createUser({ email: "teacher-candidate-count@test.local", role: "TEACHER" });
    const general = await prisma.classType.create({ data: { name: "General" } });
    await prisma.classType.create({
      data: { name: "Entrenamiento funcional", imageUrl: "https://cdn.example.test/functional.webp" }
    });
    await prisma.imageBank.create({
      data: { keyword: "cardio", imageUrl: "https://legacy.example.test/cardio.webp" }
    });
    const startsAt = addMinutes(new Date(), 120);
    await prisma.gymClass.create({
      data: {
        title: "Functional fuerza",
        classTypeId: general.id,
        teacherId: teacher.id,
        maxCapacity: 10,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const classTypeFindMany = jest.spyOn(prisma.classType, "findMany");
    const imageBankFindMany = jest.spyOn(prisma.imageBank, "findMany");
    const adminAuthorization = `Bearer ${tokenFor(admin)}`;

    try {
      const listed = await request(app)
        .get("/api/classes")
        .set("Authorization", `Bearer ${tokenFor(client)}`);
      expect(listed.status).toBe(200);
      expect(classTypeFindMany).toHaveBeenCalledTimes(1);
      expect(imageBankFindMany).toHaveBeenCalledTimes(1);

      classTypeFindMany.mockClear();
      imageBankFindMany.mockClear();
      const created = await request(app)
        .post("/api/classes")
        .set("Authorization", adminAuthorization)
        .send({
          title: "Cardio legacy",
          classTypeId: general.id,
          teacherId: teacher.id,
          maxCapacity: 10,
          startsAt: addMinutes(startsAt, 120).toISOString(),
          endsAt: addMinutes(startsAt, 180).toISOString()
        });
      expect(created.status).toBe(201);
      expect(classTypeFindMany).toHaveBeenCalledTimes(1);
      expect(imageBankFindMany).toHaveBeenCalledTimes(1);

      classTypeFindMany.mockClear();
      imageBankFindMany.mockClear();
      const updated = await request(app)
        .put(`/api/classes/${created.body.id}`)
        .set("Authorization", adminAuthorization)
        .send({ title: "Functional fuerza" });
      expect(updated.status).toBe(200);
      expect(classTypeFindMany).toHaveBeenCalledTimes(1);
      expect(imageBankFindMany).toHaveBeenCalledTimes(1);
    } finally {
      classTypeFindMany.mockRestore();
      imageBankFindMany.mockRestore();
    }
  });

  it("prefers explicit overrides and round-trips set, clear and legacy inputs", async () => {
    const teacher = await createUser({ email: "teacher-override@test.local", role: "TEACHER" });
    const classType = await prisma.classType.create({
      data: { name: "Override type", imageUrl: "/uploads/class-types/default.jpg" }
    });
    const startsAt = addMinutes(new Date(), 120);
    const gymClass = await prisma.gymClass.create({
      data: {
        title: "Override contract",
        classTypeId: classType.id,
        teacherId: teacher.id,
        maxCapacity: 12,
        startsAt,
        endsAt: addMinutes(startsAt, 60)
      }
    });
    const authorization = `Bearer ${tokenFor(teacher)}`;

    const explicitSet = await request(app)
      .put(`/api/classes/${gymClass.id}`)
      .set("Host", "api.test")
      .set("Authorization", authorization)
      .send({
        image_url: "https://legacy.example.test/ignored.jpg",
        imageOverrideUrl: "https://override.example.test/set.jpg"
      });
    expect(explicitSet.status).toBe(200);
    expect(explicitSet.body).toMatchObject({
      imageUrl: "https://override.example.test/set.jpg",
      image_url: "https://override.example.test/set.jpg",
      effectiveImageUrl: "https://override.example.test/set.jpg",
      effective_image_url: "https://override.example.test/set.jpg",
      imageOverrideUrl: "https://override.example.test/set.jpg",
      image_override_url: "https://override.example.test/set.jpg"
    });

    const explicitClear = await request(app)
      .put(`/api/classes/${gymClass.id}`)
      .set("Host", "api.test")
      .set("Authorization", authorization)
      .send({
        imageUrl: "https://legacy.example.test/ignored-on-clear.jpg",
        image_override_url: null
      });
    expect(explicitClear.status).toBe(200);
    expect(explicitClear.body).toMatchObject({
      imageUrl: "http://api.test/uploads/class-types/default.jpg",
      effectiveImageUrl: "http://api.test/uploads/class-types/default.jpg",
      imageOverrideUrl: null,
      image_override_url: null
    });
    await expect(prisma.gymClass.findUniqueOrThrow({ where: { id: gymClass.id } }))
      .resolves.toMatchObject({ imageUrl: null });

    const legacySet = await request(app)
      .put(`/api/classes/${gymClass.id}`)
      .set("Authorization", authorization)
      .send({ image_url: "https://legacy.example.test/backward-compatible.jpg" });
    expect(legacySet.status).toBe(200);
    expect(legacySet.body).toMatchObject({
      effective_image_url: "https://legacy.example.test/backward-compatible.jpg",
      image_override_url: "https://legacy.example.test/backward-compatible.jpg"
    });
    await expect(prisma.gymClass.findUniqueOrThrow({ where: { id: gymClass.id } }))
      .resolves.toMatchObject({ imageUrl: "https://legacy.example.test/backward-compatible.jpg" });
  });
});
