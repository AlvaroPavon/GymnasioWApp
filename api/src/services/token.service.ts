import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";

const tokenPayloadSchema = z.object({
  sub: z.string().regex(/^\d+$/),
  role: z.enum(["ADMIN", "TEACHER", "CLIENT"])
});

export type AccessTokenPayload = z.infer<typeof tokenPayloadSchema>;

export function signAccessToken(input: { userId: number; role: "ADMIN" | "TEACHER" | "CLIENT" }) {
  return jwt.sign(
    { role: input.role },
    env.JWT_SECRET,
    {
      subject: String(input.userId),
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
    }
  );
}

export function verifyAccessToken(token: string): { userId: number; role: "ADMIN" | "TEACHER" | "CLIENT" } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const payload = tokenPayloadSchema.parse({ sub: decoded.sub, role: decoded.role });
    return { userId: Number(payload.sub), role: payload.role };
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired access token");
  }
}
