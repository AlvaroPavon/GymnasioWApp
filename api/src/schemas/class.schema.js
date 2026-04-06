import { z } from 'zod';

export const classCreateSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
    description: z.string().optional(),
    teacher_id: z.number().int().positive('ID de profesor no válido'),
    max_capacity: z.number().int().positive('La capacidad debe ser mayor a 0'),
    start_time: z.string().datetime({ message: "Formato de fecha de inicio inválido (Usa ISO 8601)" }),
    end_time: z.string().datetime({ message: "Formato de fecha de fin inválido (Usa ISO 8601)" })
  }).refine((data) => new Date(data.start_time) < new Date(data.end_time), {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["end_time"]
  })
});
