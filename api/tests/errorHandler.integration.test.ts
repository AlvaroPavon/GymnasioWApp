import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API error handling", () => {
  it("returns 400 for malformed JSON instead of exposing an internal error", async () => {
    const response = await request(app)
      .put("/api/users/1/password")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});
