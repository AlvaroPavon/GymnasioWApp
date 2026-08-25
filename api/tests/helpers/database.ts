import bcrypt from "bcryptjs";
import { addMinutes, addMonths } from "date-fns";
import path from "node:path";
import { z } from "zod";

const safeTestEnvironmentSchema = z.object({
  NODE_ENV: z.literal("test"),
  DATABASE_URL: z.string().url()
});

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

let prismaPromise: Promise<typeof import("../../src/db/prisma.js").prisma> | undefined;

async function getPrisma() {
  prismaPromise ??= import("../../src/db/prisma.js").then(({ prisma }) => prisma);
  return prismaPromise;
}

/**
 * Allows test mutations only against the dedicated loopback MySQL database.
 * The exact port and database name prevent accidental local or remote data loss.
 */
export function assertSafeTestDatabase(environment: NodeJS.ProcessEnv = process.env) {
  const parsedEnvironment = safeTestEnvironmentSchema.safeParse(environment);
  if (!parsedEnvironment.success) {
    throw new Error("Refusing unsafe test database: NODE_ENV must be test and DATABASE_URL must be explicit");
  }

  const databaseUrl = new URL(parsedEnvironment.data.DATABASE_URL);
  const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));

  if (
    databaseUrl.protocol !== "mysql:" ||
    !loopbackHosts.has(hostname) ||
    databaseUrl.port !== "3307" ||
    database !== "gimnasio_test"
  ) {
    throw new Error(
      "Refusing unsafe test database: expected mysql on a loopback host, port 3307, database gimnasio_test"
    );
  }
}

/** Deletes integration-test data after proving the target database is safe. */
export async function resetDatabase() {
  assertSafeTestDatabase();
  const prisma = await getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.adminNotification.deleteMany();
    await tx.membershipPayment.deleteMany();
    await tx.penalty.deleteMany();
    await tx.reservation.deleteMany();
    await tx.gymClass.deleteMany();
    await tx.pushDevice.deleteMany();
    await tx.imageBank.deleteMany();
    await tx.classType.deleteMany();
    await tx.user.deleteMany();
    await tx.systemSettings.deleteMany();
  });
}

export async function createUser(input: {
  email: string;
  role?: "ADMIN" | "TEACHER" | "CLIENT";
  monthlyStatus?: "PAGADO" | "IMPAGADO";
  name?: string;
}) {
  assertSafeTestDatabase();
  const prisma = await getPrisma();
  const passwordHash = await bcrypt.hash("Password123!", 10);
  return prisma.user.create({
    data: {
      name: input.name ?? input.email.split("@")[0],
      email: input.email,
      passwordHash,
      role: input.role ?? "CLIENT",
      monthlyStatus: input.role && input.role !== "CLIENT" ? "PAGADO" : input.monthlyStatus ?? "PAGADO",
      membershipExpiresAt: !input.role || input.role === "CLIENT" ? addMonths(new Date(), 1) : null
    }
  });
}

export async function createGymClass(input: {
  teacherId: number;
  capacity?: number;
  startsAt?: Date;
  classTypeName?: string;
}) {
  assertSafeTestDatabase();
  const prisma = await getPrisma();
  const classType = await prisma.classType.create({ data: { name: input.classTypeName ?? `Type-${crypto.randomUUID()}` } });
  const startsAt = input.startsAt ?? addMinutes(new Date(), 120);
  const gymClass = await prisma.gymClass.create({
    data: {
      title: "Morning Yoga",
      description: "Integration test class",
      classTypeId: classType.id,
      teacherId: input.teacherId,
      maxCapacity: input.capacity ?? 1,
      startsAt,
      endsAt: addMinutes(startsAt, 60)
    }
  });
  return { classType, gymClass };
}

const directInvocation = process.argv[1]
  ? /[\\/]tests[\\/]helpers[\\/]database\.(?:ts|js)$/.test(path.resolve(process.argv[1]))
  : false;

if (directInvocation) {
  assertSafeTestDatabase();
}
