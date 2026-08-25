import { parseEnv } from "../src/config/env.js";

const requiredEnvironment = {
  DATABASE_URL: "mysql://gimnasio:gimnasio@localhost:3306/gimnasio",
  JWT_SECRET: "change_me_to_at_least_32_chars_for_tests"
};

describe("API environment", () => {
  it("keeps demo seeding disabled unless explicitly enabled", () => {
    expect(parseEnv(requiredEnvironment).ALLOW_DEMO_SEED).toBe(false);
    expect(parseEnv({ ...requiredEnvironment, ALLOW_DEMO_SEED: "true" }).ALLOW_DEMO_SEED).toBe(true);
  });

  it.each(["TRUE", "1", "yes"])("rejects ambiguous demo seed opt-in %s", (value) => {
    expect(() => parseEnv({ ...requiredEnvironment, ALLOW_DEMO_SEED: value })).toThrow();
  });

  it("rejects non-MySQL database URLs", () => {
    expect(() => parseEnv({
      ...requiredEnvironment,
      DATABASE_URL: "https://database.example.com/gimnasio"
    })).toThrow("DATABASE_URL must use mysql");
  });
});
