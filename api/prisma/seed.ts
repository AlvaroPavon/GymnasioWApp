import bcrypt from "bcryptjs";
import { addDays, addHours, addMonths } from "date-fns";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { assertDemoSeedAllowed, ensureClassTypeAssets } from "./seed.helpers.js";

async function main() {
  assertDemoSeedAllowed(process.env);
  const seedPassword = process.env.SEED_PASSWORD ?? "Password123!";

  const passwordHash = await bcrypt.hash(seedPassword, env.BCRYPT_COST);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gimnasiowapp.local" },
    update: { monthlyStatus: "PAGADO" },
    create: {
      name: "Admin",
      email: "admin@gimnasiowapp.local",
      passwordHash,
      role: "ADMIN",
      monthlyStatus: "PAGADO",
      phone: "+34 600 000 001"
    }
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@gimnasiowapp.local" },
    update: { monthlyStatus: "PAGADO" },
    create: {
      name: "Teacher Coach",
      email: "teacher@gimnasiowapp.local",
      passwordHash,
      role: "TEACHER",
      monthlyStatus: "PAGADO",
      phone: "+34 600 000 002"
    }
  });

  await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: { monthlyStatus: "PAGADO", membershipExpiresAt: addMonths(new Date(), 1) },
    create: {
      name: "Client Test",
      email: "client@example.com",
      passwordHash,
      role: "CLIENT",
      monthlyStatus: "PAGADO",
      membershipExpiresAt: addMonths(new Date(), 1),
      phone: "+34 600 000 003"
    }
  });

  await prisma.classType.createMany({
    data: [{ name: "Spinning" }, { name: "General" }],
    skipDuplicates: true
  });
  await ensureClassTypeAssets(prisma);

  await prisma.imageBank.createMany({
    data: [
      { keyword: "spinning", imageUrl: "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=1200&q=80" },
      { keyword: "yoga", imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80" },
      { keyword: "functional", imageUrl: "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=1200&q=80" }
    ],
    skipDuplicates: true
  });

  const yoga = await prisma.classType.findUniqueOrThrow({ where: { name: "Yoga" } });
  const spinning = await prisma.classType.findUniqueOrThrow({ where: { name: "Spinning" } });
  const existingClasses = await prisma.gymClass.count();
  if (existingClasses === 0) {
    await prisma.gymClass.createMany({
      data: [
        {
          title: "Yoga Flow",
          description: "Mobility, breathing and core control.",
          classTypeId: yoga.id,
          teacherId: teacher.id,
          maxCapacity: 12,
          startsAt: addHours(addDays(new Date(), 1), 10),
          endsAt: addHours(addDays(new Date(), 1), 11),
          imageUrl: null
        },
        {
          title: "Spinning Power",
          description: "High-intensity indoor cycling session.",
          classTypeId: spinning.id,
          teacherId: teacher.id,
          maxCapacity: 10,
          startsAt: addHours(addDays(new Date(), 2), 18),
          endsAt: addHours(addDays(new Date(), 2), 19),
          imageUrl: null
        }
      ]
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      appName: "Ronquillo Te Cuida",
      heroImage: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=1400&q=80"
    }
  });

  console.log({
    admin: admin.email,
    teacher: teacher.email,
    client: "client@example.com",
    password: env.NODE_ENV === "production" ? "configured via SEED_PASSWORD" : seedPassword
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
