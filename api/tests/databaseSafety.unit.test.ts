import { assertSafeTestDatabase, resetDatabase } from "./helpers/database.js";

jest.mock("../src/db/prisma.js", () => ({
  prisma: {
    $transaction: jest.fn()
  }
}));

const safeEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "mysql://gimnasio:gimnasio@127.0.0.1:3307/gimnasio_test"
};

describe("test database safety", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    jest.clearAllMocks();
  });

  it.each([
    ["development", safeEnvironment.DATABASE_URL],
    ["test", "mysql://gimnasio:gimnasio@database.example.com:3307/gimnasio_test"],
    ["test", "mysql://gimnasio:gimnasio@127.0.0.1:3306/gimnasio_test"],
    ["test", "mysql://gimnasio:gimnasio@127.0.0.1:3307/gimnasio"]
  ])("rejects NODE_ENV=%s with DATABASE_URL=%s", (nodeEnv, databaseUrl) => {
    expect(() => assertSafeTestDatabase({
      NODE_ENV: nodeEnv,
      DATABASE_URL: databaseUrl
    })).toThrow("Refusing unsafe test database");
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("accepts loopback host %s", (host) => {
    expect(() => assertSafeTestDatabase({
      ...safeEnvironment,
      DATABASE_URL: `mysql://gimnasio:gimnasio@${host}:3307/gimnasio_test`
    })).not.toThrow();
  });

  it("aborts resetDatabase before opening a transaction for an unsafe target", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "mysql://gimnasio:gimnasio@127.0.0.1:3307/gimnasio";
    const { prisma } = jest.requireMock("../src/db/prisma.js") as {
      prisma: { $transaction: jest.Mock };
    };

    await expect(resetDatabase()).rejects.toThrow("Refusing unsafe test database");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
