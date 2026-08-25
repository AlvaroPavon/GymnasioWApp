import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { signAccessToken } from "./token.service.js";
import { userDto } from "../utils/dto.js";

export async function registerClient(input: { name: string; email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "Email is already registered");

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_COST);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
      role: "CLIENT",
      monthlyStatus: "IMPAGADO"
    }
  });

  const token = signAccessToken({ userId: user.id, role: user.role });
  return { user: userDto(user), accessToken: token, token };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const token = signAccessToken({ userId: user.id, role: user.role });
  return { user: userDto(user), accessToken: token, token };
}
