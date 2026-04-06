import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    email: z.string().email('Email no válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    role: z.enum(['ADMIN', 'TEACHER', 'CLIENT']).optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email no válido'),
    password: z.string().min(1, 'Contraseña es requerida')
  })
});
