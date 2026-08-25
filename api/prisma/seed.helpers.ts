import type { PrismaClient } from "../src/generated/prisma/index.js";
import { z } from "zod";

const functionalImageUrl = "/uploads/class-types/entrenamiento-funcional.jpg";

const classTypeAssets = {
  "Entrenamiento funcional": functionalImageUrl,
  Yoga: "/uploads/class-types/yoga.jpg",
  Pilates: "/uploads/class-types/pilates.jpg"
} as const;

type SeedDatabase = Pick<PrismaClient, "classType">;

const demoSeedEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test"]),
  ALLOW_DEMO_SEED: z.literal("true"),
  DATABASE_URL: z.string().url()
});

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizedHostname(url: URL) {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function databaseName(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""));
}

/**
 * Refuses demo seeding unless the caller explicitly opts in to one of the
 * project's known local development or test databases.
 */
export function assertDemoSeedAllowed(environment: NodeJS.ProcessEnv = process.env) {
  const databaseUrlResult = z.string().url().safeParse(environment.DATABASE_URL);
  if (!databaseUrlResult.success) {
    throw new Error("Refusing demo seed: DATABASE_URL must be an explicit local MySQL URL");
  }

  const databaseUrl = new URL(databaseUrlResult.data);
  if (databaseUrl.protocol !== "mysql:" || !loopbackHosts.has(normalizedHostname(databaseUrl))) {
    throw new Error("Refusing demo seed: DATABASE_URL must use a loopback MySQL host");
  }

  const parsedEnvironment = demoSeedEnvironmentSchema.safeParse(environment);
  if (!parsedEnvironment.success) {
    throw new Error("Refusing demo seed: set NODE_ENV to development/test and ALLOW_DEMO_SEED=true");
  }

  const expectedTarget = parsedEnvironment.data.NODE_ENV === "test"
    ? { port: "3307", database: "gimnasio_test" }
    : { port: "3306", database: "gimnasio" };

  if (databaseUrl.port !== expectedTarget.port || databaseName(databaseUrl) !== expectedTarget.database) {
    throw new Error(
      `Refusing demo seed: ${parsedEnvironment.data.NODE_ENV} must use local database ` +
      `${expectedTarget.database} on port ${expectedTarget.port}`
    );
  }
}

/** Ensures built-in class types have local fallback image assets. */
export async function ensureClassTypeAssets(database: SeedDatabase) {
  const legacyFunctional = await database.classType.findUnique({
    where: { name: "Functional" }
  });

  if (legacyFunctional && !legacyFunctional.imageUrl) {
    await database.classType.update({
      where: { id: legacyFunctional.id },
      data: { imageUrl: functionalImageUrl }
    });
  }

  for (const [name, imageUrl] of Object.entries(classTypeAssets)) {
    const classType = await database.classType.upsert({
      where: { name },
      update: {},
      create: { name, imageUrl }
    });
    if (!classType.imageUrl) {
      await database.classType.update({
        where: { id: classType.id },
        data: { imageUrl }
      });
    }
  }
}
