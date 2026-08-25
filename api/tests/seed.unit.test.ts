import { assertDemoSeedAllowed, ensureClassTypeAssets } from "../prisma/seed.helpers.js";

type ClassTypeRow = {
  id: number;
  name: string;
  imageUrl: string | null;
};

function createClassTypeDatabase(initialRows: ClassTypeRow[]) {
  const rows = new Map(initialRows.map((row) => [row.id, { ...row }]));
  let nextId = Math.max(0, ...rows.keys()) + 1;

  const classType = {
    findUnique: jest.fn(async ({ where }: { where: { name: string } }) =>
      [...rows.values()].find((row) => row.name === where.name) ?? null),
    upsert: jest.fn(async ({ where, create }: {
      where: { name: string };
      create: { name: string; imageUrl: string };
    }) => {
      const existing = [...rows.values()].find((row) => row.name === where.name);
      if (existing) return existing;

      const created = { id: nextId++, ...create };
      rows.set(created.id, created);
      return created;
    }),
    update: jest.fn(async ({ where, data }: {
      where: { id: number };
      data: { imageUrl: string };
    }) => {
      const existing = rows.get(where.id);
      if (!existing) throw new Error(`Missing class type ${where.id}`);
      const updated = { ...existing, ...data };
      rows.set(updated.id, updated);
      return updated;
    })
  };

  return {
    database: { classType } as unknown as Parameters<typeof ensureClassTypeAssets>[0],
    rows
  };
}

describe("seed safety", () => {
  it("allows explicitly opted-in seeding of the known local development database", () => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: "development",
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: "mysql://gimnasio:gimnasio@localhost:3306/gimnasio"
    })).not.toThrow();
  });

  it("allows explicitly opted-in seeding of the dedicated local test database", () => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: "test",
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: "mysql://gimnasio:gimnasio@127.0.0.1:3307/gimnasio_test"
    })).not.toThrow();
  });

  it.each([undefined, "false", "1", "TRUE"])("rejects a missing or non-exact opt-in value %s", (optIn) => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: "development",
      ALLOW_DEMO_SEED: optIn,
      DATABASE_URL: "mysql://gimnasio:gimnasio@localhost:3306/gimnasio"
    })).toThrow("ALLOW_DEMO_SEED=true");
  });

  it("rejects a remote database even when NODE_ENV is missing", () => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: undefined,
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: "mysql://user:password@database.example.com:3306/gimnasio"
    })).toThrow("loopback MySQL host");
  });

  it.each([undefined, "production"])("rejects local seeding when NODE_ENV is %s", (nodeEnv) => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: nodeEnv,
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: "mysql://gimnasio:gimnasio@localhost:3306/gimnasio"
    })).toThrow("NODE_ENV to development/test");
  });

  it.each([
    ["development", "mysql://gimnasio:gimnasio@localhost:3306/gimnasio_test"],
    ["test", "mysql://gimnasio:gimnasio@localhost:3306/gimnasio_test"],
    ["test", "mysql://gimnasio:gimnasio@localhost:3307/gimnasio"]
  ])("rejects %s seeding against unexpected target %s", (nodeEnv, databaseUrl) => {
    expect(() => assertDemoSeedAllowed({
      NODE_ENV: nodeEnv,
      ALLOW_DEMO_SEED: "true",
      DATABASE_URL: databaseUrl
    })).toThrow("Refusing demo seed");
  });

  it("preserves Functional aliases and IDs while filling only missing compatible images", async () => {
    const { database, rows } = createClassTypeDatabase([
      { id: 10, name: "Functional", imageUrl: null },
      { id: 20, name: "Entrenamiento funcional", imageUrl: "https://custom.example.test/functional.jpg" }
    ]);

    await ensureClassTypeAssets(database);

    expect(rows.get(10)).toEqual({
      id: 10,
      name: "Functional",
      imageUrl: "/uploads/class-types/entrenamiento-funcional.jpg"
    });
    expect(rows.get(20)).toEqual({
      id: 20,
      name: "Entrenamiento funcional",
      imageUrl: "https://custom.example.test/functional.jpg"
    });
    expect([...rows.values()].filter(({ name }) =>
      name === "Functional" || name === "Entrenamiento funcional"
    )).toHaveLength(2);
  });

  it("keeps a lone Functional row unchanged while creating the canonical local default", async () => {
    const { database, rows } = createClassTypeDatabase([
      { id: 42, name: "Functional", imageUrl: null }
    ]);

    await ensureClassTypeAssets(database);

    expect(rows.get(42)).toEqual({
      id: 42,
      name: "Functional",
      imageUrl: "/uploads/class-types/entrenamiento-funcional.jpg"
    });
    expect([...rows.values()]).toContainEqual(expect.objectContaining({
      name: "Entrenamiento funcional",
      imageUrl: "/uploads/class-types/entrenamiento-funcional.jpg"
    }));
  });
});
