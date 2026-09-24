import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { AppError } from "../errors/AppError.js";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const acceptedMimeFormats = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const generatedUploadName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;
const maxImageWidth = 8_192;
const maxImageHeight = 8_192;
const maxImagePixels = 25_000_000;

export const uploadFileSizeLimits = {
  profile: 2 * 1024 * 1024,
  hero: 3 * 1024 * 1024,
  image: 4 * 1024 * 1024
} as const;

type RasterUploadKind = keyof typeof uploadFileSizeLimits;

const uploadFolders: Record<RasterUploadKind, string> = {
  profile: "profiles",
  hero: "settings",
  image: "class-types"
};

export function uploadFileSizeLimitMb(field?: string) {
  if (!field || !(field in uploadFileSizeLimits)) return undefined;
  return uploadFileSizeLimits[field as RasterUploadKind] / (1024 * 1024);
}

function imageFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (!acceptedMimeFormats.has(file.mimetype)) {
    cb(new AppError(400, "INVALID_IMAGE_TYPE", "Only jpeg, png and webp images are allowed"));
    return;
  }
  cb(null, true);
}

function rasterUploader(kind: RasterUploadKind) {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: { fileSize: uploadFileSizeLimits[kind], files: 1 }
  });
}

export const uploadProfile = rasterUploader("profile");
export const uploadSettings = rasterUploader("hero");
export const uploadClassTypeImage = rasterUploader("image");

async function normalizeRasterImage(file: Express.Multer.File, kind: RasterUploadKind) {
  try {
    const metadata = await sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: false
    }).metadata();
    const expectedFormat = acceptedMimeFormats.get(file.mimetype);

    if (
      !expectedFormat
      || metadata.format !== expectedFormat
      || !metadata.width
      || !metadata.height
      || (metadata.pages ?? 1) !== 1
    ) {
      throw new AppError(400, "INVALID_IMAGE_CONTENT", "The uploaded file is not a valid jpeg, png or webp image");
    }

    const pixels = metadata.width * metadata.height;
    if (metadata.width > maxImageWidth || metadata.height > maxImageHeight || pixels > maxImagePixels) {
      throw new AppError(
        400,
        "IMAGE_DIMENSIONS_TOO_LARGE",
        `Image dimensions must not exceed ${maxImageWidth}x${maxImageHeight} or ${maxImagePixels} pixels`
      );
    }

    const normalizedImage = await sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: maxImagePixels
    })
      .rotate()
      .webp({ quality: 82, alphaQuality: 90, effort: 4 })
      .toBuffer();

    if (normalizedImage.byteLength > uploadFileSizeLimits[kind]) {
      throw new AppError(
        400,
        "IMAGE_TOO_LARGE",
        `Normalized image exceeds the ${uploadFileSizeLimitMb(kind)} MB limit`
      );
    }

    return normalizedImage;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_IMAGE_CONTENT", "The uploaded file is not a valid jpeg, png or webp image");
  }
}

async function persistRasterImage(file: Express.Multer.File, kind: RasterUploadKind) {
  const normalizedImage = await normalizeRasterImage(file, kind);
  const folder = uploadFolders[kind];
  const uploadDir = path.join(uploadRoot, folder);
  const filename = `${crypto.randomUUID()}.webp`;
  const absolutePath = path.join(uploadDir, filename);

  await fs.promises.mkdir(uploadDir, { recursive: true });
  try {
    await fs.promises.writeFile(absolutePath, normalizedImage, { flag: "wx" });
  } catch (error) {
    await fs.promises.unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  return `/uploads/${folder}/${filename}`;
}

function generatedUploadPath(imageUrl: string, kind: RasterUploadKind) {
  const folder = uploadFolders[kind];
  const prefix = `/uploads/${folder}/`;
  let pathname: string;
  try {
    pathname = new URL(imageUrl, "http://local.invalid").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(prefix)) return null;

  const filename = pathname.slice(prefix.length);
  if (!generatedUploadName.test(filename)) return null;
  const uploadDir = path.join(uploadRoot, folder);
  const target = path.resolve(uploadDir, filename);
  const relative = path.relative(uploadDir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return target;
}

async function deleteGeneratedUpload(imageUrl: string, kind: RasterUploadKind) {
  const target = generatedUploadPath(imageUrl, kind);
  if (!target) return false;
  try {
    await fs.promises.unlink(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function withPersistedRasterImage<T>(
  file: Express.Multer.File | undefined,
  kind: RasterUploadKind,
  operation: (imageUrl: string | undefined) => Promise<T>
) {
  const imageUrl = file ? await persistRasterImage(file, kind) : undefined;
  try {
    return await operation(imageUrl);
  } catch (error) {
    if (imageUrl) await deleteGeneratedUpload(imageUrl, kind).catch(() => undefined);
    throw error;
  }
}

/** Persists a canonical profile WebP and removes it if the owning database mutation fails. */
export function withPersistedProfileImage<T>(
  file: Express.Multer.File | undefined,
  operation: (imageUrl: string | undefined) => Promise<T>
) {
  return withPersistedRasterImage(file, "profile", operation);
}

/** Persists a canonical hero WebP and removes it if the owning database mutation fails. */
export function withPersistedHeroImage<T>(
  file: Express.Multer.File | undefined,
  operation: (imageUrl: string | undefined) => Promise<T>
) {
  return withPersistedRasterImage(file, "hero", operation);
}

/** Decodes and stores a metadata-free canonical WebP using a server-generated filename. */
export function persistClassTypeImage(file: Express.Multer.File) {
  return persistRasterImage(file, "image");
}

/**
 * Returns the filename only for canonical WebP uploads generated by this API.
 * Bundled/default names and URLs from untrusted origins never identify deletable files.
 */
export function generatedClassTypeUploadKey(imageUrl?: string | null, trustedOrigin?: string | null) {
  if (!imageUrl) return false;

  let pathname: string;
  if (imageUrl.startsWith("/uploads/class-types/")) {
    try {
      pathname = new URL(imageUrl, "http://local.invalid").pathname;
    } catch {
      return null;
    }
  } else {
    if (!trustedOrigin) return null;
    try {
      const parsedImageUrl = new URL(imageUrl);
      const parsedTrustedOrigin = new URL(trustedOrigin);
      if (
        (parsedImageUrl.protocol !== "http:" && parsedImageUrl.protocol !== "https:")
        || parsedImageUrl.origin !== parsedTrustedOrigin.origin
      ) {
        return null;
      }
      pathname = parsedImageUrl.pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith("/uploads/class-types/")) return null;

  const filename = pathname.slice("/uploads/class-types/".length);
  if (!generatedUploadName.test(filename)) return null;
  const uploadDir = path.join(uploadRoot, uploadFolders.image);
  const target = path.resolve(uploadDir, filename);
  const relative = path.relative(uploadDir, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return filename.toLowerCase();
}

/** Deletes only a canonical API-generated upload whose resolved path stays in the upload directory. */
export async function deleteLocalClassTypeImage(imageUrl?: string | null, trustedOrigin?: string | null) {
  const filename = generatedClassTypeUploadKey(imageUrl, trustedOrigin);
  if (!filename) return false;
  return deleteGeneratedUpload(`/uploads/class-types/${filename}`, "image");
}
