import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { Prisma } from "../generated/prisma/client.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { effectiveClassImage } from "../services/classImage.service.js";
import { reservationService } from "../services/reservation.service.js";
import { classDto } from "../utils/dto.js";
import { absolutePublicUrl } from "../utils/publicUrl.js";

const router = Router();
const visibleReservationStatuses = ["CONFIRMADA", "ASISTENCIA_VALIDADA", "EN_ESPERA", "NO_ASISTE"] as const;
const occupyingReservationStatuses = ["CONFIRMADA", "ASISTENCIA_VALIDADA"] as const;

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const isoOrLocalDate = z.string().min(10).transform((value) => new Date(value));
const explicitImageOverride = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().url().nullable().optional()
);

const classBody = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  titulo: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(5000).optional(),
  descripcion: z.string().trim().max(5000).optional(),
  classTypeId: z.coerce.number().int().positive().optional(),
  tipo_clase_id: z.coerce.number().int().positive().optional(),
  teacherId: z.coerce.number().int().positive().optional(),
  teacher_id: z.coerce.number().int().positive().optional(),
  maxCapacity: z.coerce.number().int().positive().max(500).optional(),
  max_capacity: z.coerce.number().int().positive().max(500).optional(),
  startsAt: isoOrLocalDate.optional(),
  start_time: isoOrLocalDate.optional(),
  endsAt: isoOrLocalDate.optional(),
  end_time: isoOrLocalDate.optional(),
  imageUrl: z.string().url().optional(),
  image_url: z.string().url().optional(),
  imageOverrideUrl: explicitImageOverride,
  image_override_url: explicitImageOverride
}).passthrough();

async function defaultClassTypeId() {
  const classType = await prisma.classType.upsert({
    where: { name: "General" },
    update: {},
    create: { name: "General" }
  });
  return classType.id;
}

function normalizeClassBody(body: z.infer<typeof classBody>) {
  const title = body.title ?? body.titulo;
  const description = body.description ?? body.descripcion;
  const classTypeId = body.classTypeId ?? body.tipo_clase_id;
  const teacherId = body.teacherId ?? body.teacher_id;
  const maxCapacity = body.maxCapacity ?? body.max_capacity;
  const startsAt = body.startsAt ?? body.start_time;
  const endsAt = body.endsAt ?? body.end_time;
  const explicitOverrideProvided = Object.hasOwn(body, "imageOverrideUrl") || Object.hasOwn(body, "image_override_url");
  const legacyImageProvided = Object.hasOwn(body, "imageUrl") || Object.hasOwn(body, "image_url");
  const imageOverrideUrl = explicitOverrideProvided
    ? Object.hasOwn(body, "imageOverrideUrl") ? body.imageOverrideUrl : body.image_override_url
    : body.imageUrl ?? body.image_url;
  const imageInput = explicitOverrideProvided ? "explicit" : legacyImageProvided ? "legacy" : "none";
  return { title, description, classTypeId, teacherId, maxCapacity, startsAt, endsAt, imageOverrideUrl, imageInput };
}

async function assertTeacher(teacherId: number) {
  const teacher = await prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, role: true } });
  if (!teacher || teacher.role !== "TEACHER") throw new AppError(400, "INVALID_TEACHER", "teacherId must belong to a teacher");
}

/** Loads each shared image source once so class serialization never performs per-row queries. */
function loadClassImageSources() {
  return Promise.all([
    prisma.classType.findMany({
      where: { imageUrl: { not: null } },
      select: { name: true, imageUrl: true }
    }),
    prisma.imageBank.findMany({ select: { keyword: true, imageUrl: true } })
  ]);
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const viewerRole = req.auth.role;
  const reservationWhere = viewerRole === "CLIENT"
    ? { status: { in: [...visibleReservationStatuses] }, userId: req.auth.userId }
    : { status: { in: [...visibleReservationStatuses] } };
  const [classes, [classTypeImages, imageBank]] = await Promise.all([
    prisma.gymClass.findMany({
      where: viewerRole === "TEACHER" ? { teacherId: req.auth.userId } : undefined,
      orderBy: { startsAt: "asc" },
      include: {
        classType: true,
        teacher: true,
        reservations: {
          where: reservationWhere,
          orderBy: { requestedAt: "asc" },
          include: { user: true }
        },
        _count: {
          select: {
            reservations: { where: { status: { in: [...occupyingReservationStatuses] } } }
          }
        }
      }
    }),
    loadClassImageSources()
  ]);
  res.json(classes.map((gymClass) => classDto(gymClass, {
    effectiveImageUrl: effectiveClassImage(gymClass, classTypeImages, imageBank),
    absoluteUrl: (value) => absolutePublicUrl(req, value),
    viewerRole
  })));
}));

router.post("/", authenticate, requireRoles("ADMIN", "TEACHER"), validate({ body: classBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const data = normalizeClassBody(req.body);
  if (!data.title || !data.maxCapacity || !data.startsAt || !data.endsAt) {
    throw new AppError(400, "INVALID_CLASS_PAYLOAD", "title, maxCapacity, startsAt and endsAt are required");
  }
  if (data.endsAt <= data.startsAt) throw new AppError(400, "INVALID_CLASS_DATES", "Class end time must be after start time");

  const teacherId = req.auth.role === "TEACHER" ? req.auth.userId : data.teacherId;
  if (!teacherId) throw new AppError(400, "TEACHER_REQUIRED", "teacherId is required when an admin creates a class");
  await assertTeacher(teacherId);

  const gymClass = await prisma.gymClass.create({
    data: {
      title: data.title,
      description: data.description,
      classTypeId: data.classTypeId ?? await defaultClassTypeId(),
      teacherId,
      maxCapacity: data.maxCapacity,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      imageUrl: data.imageOverrideUrl
    },
    include: {
      classType: true,
      teacher: true,
      reservations: { where: { status: { in: [...visibleReservationStatuses] } }, include: { user: true } },
      _count: { select: { reservations: { where: { status: { in: [...occupyingReservationStatuses] } } } } }
    }
  });

  const [classTypeImages, imageBank] = await loadClassImageSources();
  res.status(201).json(classDto(gymClass, {
    effectiveImageUrl: effectiveClassImage(gymClass, classTypeImages, imageBank),
    absoluteUrl: (value) => absolutePublicUrl(req, value),
    viewerRole: req.auth.role
  }));
}));

router.put("/:id", authenticate, requireRoles("ADMIN", "TEACHER"), validate({ params: idParams, body: classBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const auth = req.auth;
  const params = req.params as unknown as z.infer<typeof idParams>;
  const data = normalizeClassBody(req.body);
  const teacherId = auth.role === "ADMIN" ? data.teacherId : undefined;
  if (teacherId) await assertTeacher(teacherId);

  const [classTypeImages, imageBank] = await loadClassImageSources();
  const gymClass = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM Clases
      WHERE id = ${params.id}
      FOR UPDATE
    `;
    if (!locked[0]) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");

    const existing = await tx.gymClass.findUnique({ where: { id: params.id }, include: { classType: true } });
    if (!existing) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found");
    if (auth.role === "TEACHER" && existing.teacherId !== auth.userId) {
      throw new AppError(403, "TEACHER_NOT_CLASS_OWNER", "Teachers can only edit their own classes");
    }

    const startsAt = data.startsAt ?? existing.startsAt;
    const endsAt = data.endsAt ?? existing.endsAt;
    if (endsAt <= startsAt) throw new AppError(400, "INVALID_CLASS_DATES", "Class end time must be after start time");

    if (data.maxCapacity !== undefined) {
      const occupied = await tx.reservation.count({
        where: { classId: params.id, status: { in: [...occupyingReservationStatuses] } }
      });
      if (data.maxCapacity < occupied) {
        throw new AppError(409, "CAPACITY_BELOW_OCCUPANCY", "Class capacity cannot be lower than confirmed attendance", {
          requestedCapacity: data.maxCapacity,
          occupied
        });
      }
    }

    let imageOverrideUrl = data.imageOverrideUrl;
    if (data.imageInput === "legacy" && existing.imageUrl === null && imageOverrideUrl) {
      const currentEffectiveImage = effectiveClassImage(existing, classTypeImages, imageBank);
      if (absolutePublicUrl(req, imageOverrideUrl) === absolutePublicUrl(req, currentEffectiveImage)) {
        imageOverrideUrl = undefined;
      }
    }

    return tx.gymClass.update({
      where: { id: params.id },
      data: {
        title: data.title,
        description: data.description,
        classTypeId: data.classTypeId,
        teacherId,
        maxCapacity: data.maxCapacity,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        imageUrl: imageOverrideUrl
      },
      include: {
        classType: true,
        teacher: true,
        reservations: { where: { status: { in: [...visibleReservationStatuses] } }, include: { user: true } },
        _count: { select: { reservations: { where: { status: { in: [...occupyingReservationStatuses] } } } } }
      }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5_000,
    timeout: 15_000
  });
  res.json(classDto(gymClass, {
    effectiveImageUrl: effectiveClassImage(gymClass, classTypeImages, imageBank),
    absoluteUrl: (value) => absolutePublicUrl(req, value),
    viewerRole: auth.role
  }));
}));

router.delete("/:id", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  await prisma.gymClass.delete({ where: { id: params.id } });
  res.status(204).send();
}));

router.post("/:id/reserve", authenticate, requireRoles("CLIENT"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as z.infer<typeof idParams>;
  const result = await reservationService.reserveClass(req.auth.userId, params.id);
  res.status(201).json(result);
}));

router.post("/:id/cancel", authenticate, requireRoles("CLIENT"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as z.infer<typeof idParams>;
  const result = await reservationService.cancelReservationAndPromote({
    actorUserId: req.auth.userId,
    actorRole: req.auth.role,
    targetUserId: req.auth.userId,
    classId: params.id
  });
  res.json(result);
}));

export { router as classRouter };
