import { Router } from "express";
import { z } from "zod";
import { addWeeks } from "date-fns";
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
const reserveBody = z.preprocess(
  (value) => value ?? {},
  z.object({
    hideName: z.boolean().optional(),
    hide_name: z.boolean().optional(),
    ocultar_nombre: z.boolean().optional()
  }).strict()
);
const isoOrLocalDate = z.string()
  .min(10)
  .transform((value) => new Date(value))
  .refine((value) => Number.isFinite(value.getTime()), "Invalid class date-time");
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
  image_override_url: explicitImageOverride,
  repeatWeeks: z.coerce.number().int().min(1).max(52).optional(),
  repeat_weeks: z.coerce.number().int().min(1).max(52).optional(),
  fixedUserIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  fixed_user_ids: z.array(z.coerce.number().int().positive()).max(500).optional()
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
  const repeatWeeks = body.repeatWeeks ?? body.repeat_weeks ?? 1;
  const fixedUserIds = [...new Set(body.fixedUserIds ?? body.fixed_user_ids ?? [])];
  return {
    title,
    description,
    classTypeId,
    teacherId,
    maxCapacity,
    startsAt,
    endsAt,
    imageOverrideUrl,
    imageInput,
    repeatWeeks,
    fixedUserIds
  };
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
  const auth = req.auth;
  const viewerRole = auth.role;
  const reservationWhere = viewerRole === "CLIENT"
    ? {
        status: { in: [...visibleReservationStatuses] },
        OR: [
          { userId: auth.userId },
          { status: { in: [...occupyingReservationStatuses] } }
        ]
      }
    : { status: { in: [...visibleReservationStatuses] } };
  const [classes, [classTypeImages, imageBank]] = await Promise.all([
    prisma.gymClass.findMany({
      where: viewerRole === "TEACHER" ? { teacherId: auth.userId } : undefined,
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
    viewerRole,
    viewerUserId: auth.userId
  })));
}));

router.post("/", authenticate, requireRoles("ADMIN", "TEACHER"), validate({ body: classBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const auth = req.auth;
  const data = normalizeClassBody(req.body);
  const { title, maxCapacity, startsAt, endsAt } = data;
  if (!title || !maxCapacity || !startsAt || !endsAt) {
    throw new AppError(400, "INVALID_CLASS_PAYLOAD", "title, maxCapacity, startsAt and endsAt are required");
  }
  if (endsAt <= startsAt) throw new AppError(400, "INVALID_CLASS_DATES", "Class end time must be after start time");

  const teacherId = auth.role === "TEACHER" ? auth.userId : data.teacherId;
  if (!teacherId) throw new AppError(400, "TEACHER_REQUIRED", "teacherId is required when an admin creates a class");
  await assertTeacher(teacherId);

  if (data.fixedUserIds.length > maxCapacity) {
    throw new AppError(409, "FIXED_USERS_EXCEED_CAPACITY", "Fixed users cannot exceed class capacity");
  }

  const classTypeId = data.classTypeId ?? await defaultClassTypeId();
  const now = new Date();
  const classes = await prisma.$transaction(async (tx) => {
    if (data.fixedUserIds.length > 0) {
      const eligibleUsers = await tx.user.findMany({
        where: {
          id: { in: data.fixedUserIds },
          role: "CLIENT",
          monthlyStatus: "PAGADO",
          membershipExpiresAt: { gt: now }
        },
        select: { id: true }
      });
      const eligibleIds = new Set(eligibleUsers.map((user) => user.id));
      const ineligibleUserIds = data.fixedUserIds.filter((id) => !eligibleIds.has(id));
      if (ineligibleUserIds.length > 0) {
        throw new AppError(
          409,
          "FIXED_USER_NOT_ELIGIBLE",
          "Every fixed user must be an active paid client",
          { userIds: ineligibleUserIds }
        );
      }
    }

    const createdIds: number[] = [];
    for (let week = 0; week < data.repeatWeeks; week += 1) {
      const gymClass = await tx.gymClass.create({
        data: {
          title,
          description: data.description,
          classTypeId,
          teacherId,
          maxCapacity,
          startsAt: addWeeks(startsAt, week),
          endsAt: addWeeks(endsAt, week),
          imageUrl: data.imageOverrideUrl
        },
        select: { id: true }
      });
      createdIds.push(gymClass.id);

      if (data.fixedUserIds.length > 0) {
        await tx.reservation.createMany({
          data: data.fixedUserIds.map((userId) => ({
            userId,
            classId: gymClass.id,
            status: "CONFIRMADA" as const,
            requestedAt: now,
            fixedEnrollment: true
          }))
        });
      }
    }

    return tx.gymClass.findMany({
      where: { id: { in: createdIds } },
      orderBy: { startsAt: "asc" },
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
    timeout: 20_000
  });

  const [classTypeImages, imageBank] = await loadClassImageSources();
  const serializedClasses = classes.map((gymClass) => classDto(gymClass, {
    effectiveImageUrl: effectiveClassImage(gymClass, classTypeImages, imageBank),
    absoluteUrl: (value) => absolutePublicUrl(req, value),
    viewerRole: auth.role,
    viewerUserId: auth.userId
  }));
  const primaryClass = serializedClasses[0];
  res.status(201).json({
    ...primaryClass,
    series: serializedClasses,
    createdCount: serializedClasses.length,
    created_count: serializedClasses.length
  });
}));

router.put("/:id", authenticate, requireRoles("ADMIN", "TEACHER"), validate({ params: idParams, body: classBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const auth = req.auth;
  const params = req.params as unknown as z.infer<typeof idParams>;
  const data = normalizeClassBody(req.body);
  const teacherId = auth.role === "ADMIN" ? data.teacherId : undefined;
  if (teacherId) await assertTeacher(teacherId);

  const [classTypeImages, imageBank] = await loadClassImageSources();
  const result = await prisma.$transaction(async (tx) => {
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

    await tx.gymClass.update({
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
      }
    });

    const promoted = data.maxCapacity !== undefined && data.maxCapacity > existing.maxCapacity
      ? await reservationService.promoteWaitlistForCapacityIncrease(tx, params.id)
      : [];
    const gymClass = await tx.gymClass.findUniqueOrThrow({
      where: { id: params.id },
      include: {
        classType: true,
        teacher: true,
        reservations: { where: { status: { in: [...visibleReservationStatuses] } }, include: { user: true } },
        _count: { select: { reservations: { where: { status: { in: [...occupyingReservationStatuses] } } } } }
      }
    });
    return { gymClass, promoted };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 5_000,
    timeout: 15_000
  });
  await reservationService.notifyPromotedBestEffort(result.promoted);
  res.json(classDto(result.gymClass, {
    effectiveImageUrl: effectiveClassImage(result.gymClass, classTypeImages, imageBank),
    absoluteUrl: (value) => absolutePublicUrl(req, value),
    viewerRole: auth.role,
    viewerUserId: auth.userId
  }));
}));

router.delete("/:id", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  await prisma.gymClass.delete({ where: { id: params.id } });
  res.status(204).send();
}));

router.post("/:id/reserve", authenticate, requireRoles("CLIENT"), validate({ params: idParams, body: reserveBody }), asyncHandler(async (req, res) => {
  if (!req.auth) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const params = req.params as unknown as z.infer<typeof idParams>;
  const body = req.body as z.infer<typeof reserveBody>;
  const hideName = body.hideName ?? body.hide_name ?? body.ocultar_nombre ?? false;
  const result = await reservationService.reserveClass(req.auth.userId, params.id, new Date(), hideName);
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
