import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando inyección de datos de prueba (Seed)...");

  // Limpiar base de datos si tiene datos residuales (opcional pero bueno para pruebas locales puras)
  await prisma.reservation.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const passwordAdmin = await bcrypt.hash('admin123', salt);
  const passwordProfe = await bcrypt.hash('profe123', salt);
  const passwordCliente = await bcrypt.hash('cliente123', salt);

  // 1. Crear ADMIN
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@gym.com',
      password_hash: passwordAdmin,
      role: 'ADMIN'
    }
  });

  // 2. Crear PROFESOR
  const profesor = await prisma.user.create({
    data: {
      name: 'Carlos Ruiz',
      email: 'profe@gym.com',
      password_hash: passwordProfe,
      role: 'TEACHER'
    }
  });

  // 3. Crear CLIENTE
  const cliente = await prisma.user.create({
    data: {
      name: 'Laura García',
      email: 'cliente@gym.com',
      password_hash: passwordCliente,
      role: 'CLIENT'
    }
  });

  // 4. Crear Clases iniciales conectadas al profesor
  const today = new Date();
  
  // Clase Mañana
  const fechaMananaDeInicio = new Date(today);
  fechaMananaDeInicio.setDate(today.getDate() + 1);
  fechaMananaDeInicio.setHours(10, 0, 0, 0);
  const fechaMananaDeFin = new Date(fechaMananaDeInicio);
  fechaMananaDeFin.setHours(11, 0, 0, 0);

  // Clase Pasado Mañana
  const fechaPasadoInicio = new Date(today);
  fechaPasadoInicio.setDate(today.getDate() + 2);
  fechaPasadoInicio.setHours(18, 30, 0, 0);
  const fechaPasadoFin = new Date(fechaPasadoInicio);
  fechaPasadoFin.setHours(19, 30, 0, 0);

  await prisma.class.createMany({
    data: [
      {
        title: 'Spinning Extremo',
        description: 'Quema 600 kcal en 45 minutos. Traer toalla.',
        teacher_id: profesor.id,
        max_capacity: 10,
        start_time: fechaMananaDeInicio,
        end_time: fechaMananaDeFin
      },
      {
        title: 'CrossFit WOD',
        description: 'Fuerza integral y levantamientos olímpicos. Nivel avanzado.',
        teacher_id: profesor.id,
        max_capacity: 15,
        start_time: fechaPasadoInicio,
        end_time: fechaPasadoFin
      },
      {
        title: 'Yoga Relax',
        description: 'Estiramientos y respiración para terminar la semana.',
        teacher_id: profesor.id,
        max_capacity: 3, // Muy baja para probar llenar aforo pronto
        start_time: new Date(today.getTime() + 72 * 60 * 60 * 1000), // En 3 dias
        end_time: new Date(today.getTime() + 73 * 60 * 60 * 1000)
      }
    ]
  });

  console.log("¡Datos inyectados perfectamente!");
  console.log("-----------------------------------------");
  console.log("👤 ADMIN    -> admin@gym.com / admin123");
  console.log("🏋️ PROFESOR -> profe@gym.com / profe123");
  console.log("🏃 CLIENTE  -> cliente@gym.com / cliente123");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
