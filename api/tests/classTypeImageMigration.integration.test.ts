import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/db/prisma.js";

type FixtureTables = {
  classTypes: string;
  classes: string;
  penalties: string;
};

function migrationStatements(tables: FixtureTables) {
  const migrationPath = path.resolve(process.cwd(), "prisma/migrations/0004_class_type_images/migration.sql");
  return fs.readFileSync(migrationPath, "utf8")
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !statement.startsWith("ALTER TABLE `TiposClase`"))
    .map((statement) => statement
      .replaceAll("`TiposClase`", `\`${tables.classTypes}\``)
      .replaceAll("`Clases`", `\`${tables.classes}\``)
      .replaceAll("`Penalizaciones`", `\`${tables.penalties}\``));
}

describe("0004 class-type image migration", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function expectPreservedFixture(input: {
    classTypeValues: string;
    classValues: string;
    penaltyValues: string;
    expectedTypes: Array<{ id: number; nombre: string; image_url: string | null }>;
    expectedClasses: Array<{ id: number; tipo_clase_id: number }>;
    expectedPenalties: Array<{ id: number; tipo_clase_id: number }>;
  }) {
    const suffix = `${process.pid}_${Date.now()}`;
    const tables = {
      classTypes: `Migration0004Types_${suffix}`,
      classes: `Migration0004Classes_${suffix}`,
      penalties: `Migration0004Penalties_${suffix}`
    } satisfies FixtureTables;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE \`${tables.classTypes}\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`nombre\` VARCHAR(80) NOT NULL,
          \`image_url\` TEXT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_tipos_clase_nombre\` (\`nombre\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE \`${tables.classes}\` (
          \`id\` INT NOT NULL,
          \`tipo_clase_id\` INT NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE \`${tables.penalties}\` (
          \`id\` INT NOT NULL,
          \`tipo_clase_id\` INT NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO \`${tables.classTypes}\` (\`id\`, \`nombre\`, \`image_url\`)
          VALUES ${input.classTypeValues}
        `);
        await tx.$executeRawUnsafe(`INSERT INTO \`${tables.classes}\` (\`id\`, \`tipo_clase_id\`) VALUES ${input.classValues}`);
        await tx.$executeRawUnsafe(`INSERT INTO \`${tables.penalties}\` (\`id\`, \`tipo_clase_id\`) VALUES ${input.penaltyValues}`);

        for (const statement of migrationStatements(tables)) {
          await tx.$executeRawUnsafe(statement);
        }

        const originalTypes = await tx.$queryRawUnsafe<Array<{ id: number; nombre: string; image_url: string | null }>>(`
          SELECT \`id\`, \`nombre\`, \`image_url\`
          FROM \`${tables.classTypes}\`
          WHERE \`id\` IN (10, 20, 30)
          ORDER BY \`id\`
        `);
        const classReferences = await tx.$queryRawUnsafe<Array<{ id: number; tipo_clase_id: number }>>(
          `SELECT \`id\`, \`tipo_clase_id\` FROM \`${tables.classes}\` ORDER BY \`id\``
        );
        const penaltyReferences = await tx.$queryRawUnsafe<Array<{ id: number; tipo_clase_id: number }>>(
          `SELECT \`id\`, \`tipo_clase_id\` FROM \`${tables.penalties}\` ORDER BY \`id\``
        );

        expect(originalTypes).toEqual(input.expectedTypes);
        expect(classReferences).toEqual(input.expectedClasses);
        expect(penaltyReferences).toEqual(input.expectedPenalties);
      }, { timeout: 15_000 });
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TABLE IF EXISTS \`${tables.penalties}\`, \`${tables.classes}\`, \`${tables.classTypes}\``
      );
    }
  }

  it("keeps both Functional rows and every foreign key when the canonical row already exists", async () => {
    await expectPreservedFixture({
      classTypeValues: [
        "(10, 'Functional', NULL)",
        "(20, 'Entrenamiento funcional', NULL)",
        "(30, 'Spinning', 'https://images.example.test/spinning.webp')"
      ].join(", "),
      classValues: "(100, 10), (101, 20), (102, 30)",
      penaltyValues: "(200, 10), (201, 20), (202, 30)",
      expectedTypes: [
        { id: 10, nombre: "Functional", image_url: "/uploads/class-types/entrenamiento-funcional.jpg" },
        { id: 20, nombre: "Entrenamiento funcional", image_url: "/uploads/class-types/entrenamiento-funcional.jpg" },
        { id: 30, nombre: "Spinning", image_url: "https://images.example.test/spinning.webp" }
      ],
      expectedClasses: [
        { id: 100, tipo_clase_id: 10 },
        { id: 101, tipo_clase_id: 20 },
        { id: 102, tipo_clase_id: 30 }
      ],
      expectedPenalties: [
        { id: 200, tipo_clase_id: 10 },
        { id: 201, tipo_clase_id: 20 },
        { id: 202, tipo_clase_id: 30 }
      ]
    });
  });

  it("renames Functional in place only when the canonical row does not exist", async () => {
    await expectPreservedFixture({
      classTypeValues: [
        "(10, 'Functional', NULL)",
        "(30, 'Spinning', 'https://images.example.test/spinning.webp')"
      ].join(", "),
      classValues: "(100, 10), (102, 30)",
      penaltyValues: "(200, 10), (202, 30)",
      expectedTypes: [
        { id: 10, nombre: "Entrenamiento funcional", image_url: "/uploads/class-types/entrenamiento-funcional.jpg" },
        { id: 30, nombre: "Spinning", image_url: "https://images.example.test/spinning.webp" }
      ],
      expectedClasses: [
        { id: 100, tipo_clase_id: 10 },
        { id: 102, tipo_clase_id: 30 }
      ],
      expectedPenalties: [
        { id: 200, tipo_clase_id: 10 },
        { id: 202, tipo_clase_id: 30 }
      ]
    });
  });
});
