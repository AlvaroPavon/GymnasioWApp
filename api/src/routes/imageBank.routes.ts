import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { authenticate, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const imageBody = z.object({
  keyword: z.string().trim().min(2).max(120),
  imageUrl: z.string().url().optional(),
  image_url: z.string().url().optional()
}).strict().refine((value) => value.imageUrl || value.image_url, {
  message: "La URL de la imagen es obligatoria.",
  path: ["imageUrl"]
});

function imageDto(image: { id: number; keyword: string; imageUrl: string; createdAt: Date }) {
  return {
    id: image.id,
    keyword: image.keyword,
    imageUrl: image.imageUrl,
    image_url: image.imageUrl,
    createdAt: image.createdAt,
    created_at: image.createdAt
  };
}

router.get("/", authenticate, requireRoles("ADMIN"), asyncHandler(async (_req, res) => {
  const images = await prisma.imageBank.findMany({ orderBy: { keyword: "asc" } });
  res.json(images.map(imageDto));
}));

router.post("/", authenticate, requireRoles("ADMIN"), validate({ body: imageBody }), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof imageBody>;
  const image = await prisma.imageBank.upsert({
    where: { keyword: body.keyword.trim().toLowerCase() },
    update: { imageUrl: body.imageUrl ?? body.image_url! },
    create: { keyword: body.keyword.trim().toLowerCase(), imageUrl: body.imageUrl ?? body.image_url! }
  });
  res.status(201).json(imageDto(image));
}));

router.delete("/:id", authenticate, requireRoles("ADMIN"), validate({ params: idParams }), asyncHandler(async (req, res) => {
  const params = req.params as unknown as z.infer<typeof idParams>;
  await prisma.imageBank.delete({ where: { id: params.id } });
  res.status(204).send();
}));

export { router as imageBankRouter };
