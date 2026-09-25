import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  deleteLocalClassTypeImage,
  generatedClassTypeUploadKey,
  persistClassTypeImage,
  uploadClassTypeImage
} from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { classTypeDto } from "../utils/dto.js";
import { absolutePublicUrl, trustedPublicOrigin } from "../utils/publicUrl.js";

const router = Router();
const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const nullableImageUrl = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().url().nullable().optional()
);

const classTypeBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nombre: z.string().trim().min(2).max(80).optional()
}).strict().refine((value) => value.name || value.nombre, {
  message: "El nombre es obligatorio.",
  path: ["name"]
});

const classTypeUpdateBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  nombre: z.string().trim().min(2).max(80).optional(),
  imageUrl: nullableImageUrl,
  image_url: nullableImageUrl
}).strict();

/** Deletes a replaced generated upload only after the database no longer references that file. */
async function deleteOrphanedClassTypeUpload(imageUrl: string | null, trustedOrigin?: string | null) {
  const uploadKey = generatedClassTypeUploadKey(imageUrl, trustedOrigin);
  if (!uploadKey) return false;

  const [classTypes, classes, legacyImages, users, settings] = await Promise.all([
    prisma.classType.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.gymClass.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.imageBank.findMany({ select: { imageUrl: true } }),
    prisma.user.findMany({ where: { profilePicture: { not: null } }, select: { profilePicture: true } }),
    prisma.systemSettings.findMany({ where: { heroImage: { not: null } }, select: { heroImage: true } })
  ]);
  const referencedUrls = [
    ...classTypes.map((reference) => reference.imageUrl),
    ...classes.map((reference) => reference.imageUrl),
    ...legacyImages.map((reference) => reference.imageUrl),
    ...users.map((reference) => reference.profilePicture),
    ...settings.map((reference) => reference.heroImage)
  ];
  const stillUsed = referencedUrls.some((reference) =>
    generatedClassTypeUploadKey(reference, trustedOrigin) === uploadKey
  );
  return stillUsed ? false : deleteLocalClassTypeImage(imageUrl, trustedOrigin);
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const classTypes = await prisma.classType.findMany({ orderBy: { name: "asc" } });
  res.json(classTypes.map((classType) => classTypeDto(classType, (value) => absolutePublicUrl(req, value))));
}));

router.post(
  "/",
  authenticate,
  requireRoles("ADMIN"),
  uploadClassTypeImage.single("image"),
  asyncHandler(async (req, res) => {
    const body = classTypeBody.parse(req.body);
    const name = (body.name ?? body.nombre)!.trim();
    const exists = await prisma.classType.findUnique({ where: { name } });
    if (exists) throw new AppError(409, "CLASS_TYPE_ALREADY_EXISTS", "Class type already exists");

    let persistedImageUrl: string | undefined;
    let databaseUpdated = false;
    try {
      persistedImageUrl = req.file ? await persistClassTypeImage(req.file) : undefined;
      const classType = await prisma.classType.create({
        data: { name, imageUrl: persistedImageUrl }
      });
      databaseUpdated = true;
      res.status(201).json(classTypeDto(classType, (value) => absolutePublicUrl(req, value)));
    } catch (error) {
      if (persistedImageUrl && !databaseUpdated) {
        await deleteLocalClassTypeImage(persistedImageUrl).catch(() => undefined);
      }
      throw error;
    }
  })
);

router.put(
  "/:id",
  authenticate,
  requireRoles("ADMIN"),
  validate({ params: idParams }),
  uploadClassTypeImage.single("image"),
  asyncHandler(async (req, res) => {
    const params = req.params as unknown as z.infer<typeof idParams>;
    const body = classTypeUpdateBody.parse(req.body);
    const name = body.name ?? body.nombre;
    const imageUrlProvided = Object.hasOwn(body, "imageUrl") || Object.hasOwn(body, "image_url");
    const providedImageUrl = Object.hasOwn(body, "imageUrl") ? body.imageUrl : body.image_url;
    if (!name && !imageUrlProvided && !req.file) {
      throw new AppError(400, "EMPTY_CLASS_TYPE_UPDATE", "Provide a name, image URL or image file");
    }

    const existing = await prisma.classType.findUnique({ where: { id: params.id } });
    if (!existing) throw new AppError(404, "CLASS_TYPE_NOT_FOUND", "Class type not found");

    if (name) {
      const duplicate = await prisma.classType.findUnique({ where: { name: name.trim() } });
      if (duplicate && duplicate.id !== existing.id) {
        throw new AppError(409, "CLASS_TYPE_ALREADY_EXISTS", "Class type already exists");
      }
    }

    let persistedImageUrl: string | undefined;
    let databaseUpdated = false;
    try {
      persistedImageUrl = req.file ? await persistClassTypeImage(req.file) : undefined;
      const nextImageUrl = persistedImageUrl ?? (imageUrlProvided ? providedImageUrl : undefined);
      const classType = await prisma.classType.update({
        where: { id: params.id },
        data: {
          name: name?.trim(),
          imageUrl: nextImageUrl
        }
      });
      databaseUpdated = true;

      if (nextImageUrl !== undefined && existing.imageUrl !== nextImageUrl) {
        await deleteOrphanedClassTypeUpload(existing.imageUrl, trustedPublicOrigin(req)).catch((error) => {
          console.error("Could not delete replaced class-type image", error);
        });
      }

      res.json(classTypeDto(classType, (value) => absolutePublicUrl(req, value)));
    } catch (error) {
      if (persistedImageUrl && !databaseUpdated) {
        await deleteLocalClassTypeImage(persistedImageUrl).catch(() => undefined);
      }
      throw error;
    }
  })
);

export { router as classTypeRouter };
