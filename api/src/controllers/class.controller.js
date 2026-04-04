import { prisma } from '../lib/prisma.js';

export const getClasses = async (req, res) => {
  try {
    const { role, id } = req.user;
    let classes;

    if (role === 'ADMIN' || role === 'CLIENT') {
      // Admin y cliente ven todas
      classes = await prisma.class.findMany({
        include: {
          teacher: { select: { id: true, name: true } },
          _count: { select: { reservations: { where: { status: 'CONFIRMED' } } } }
        }
      });
    } else if (role === 'TEACHER') {
      // Profesor solo ve las suyas
      classes = await prisma.class.findMany({
        where: { teacher_id: id },
        include: {
          teacher: { select: { id: true, name: true } },
          reservations: {
            where: { status: 'CONFIRMED' },
            include: { user: { select: { id: true, name: true, email: true } } }
          },
          _count: { select: { reservations: { where: { status: 'CONFIRMED' } } } }
        }
      });
    }

    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo clases', error: error.message });
  }
};

export const createClass = async (req, res) => {
  try {
    const { title, description, teacher_id, max_capacity, start_time, end_time } = req.body;
    
    // Validación extra: el teacher_id debe ser un TEACHER
    const teacher = await prisma.user.findUnique({ where: { id: teacher_id } });
    if (!teacher || teacher.role !== 'TEACHER') {
      return res.status(400).json({ message: 'El ID proporcionado no corresponde a un profesor válido' });
    }

    const newClass = await prisma.class.create({
      data: {
        title,
        description,
        teacher_id,
        max_capacity,
        start_time: new Date(start_time),
        end_time: new Date(end_time)
      }
    });

    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: 'Error creando clase', error: error.message });
  }
};

export const reserveClass = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const userId = req.user.id;

    // INICIO TRANSACCIÓN CON CONTROL DE AFORO
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificamos si el usuario ya tiene la clase reservada (antes de bloquear la clase a nivel de fila)
      const existingRes = await tx.reservation.findUnique({
        where: {
          user_id_class_id: {
            user_id: userId,
            class_id: Number(classId)
          }
        }
      });

      if (existingRes && existingRes.status === 'CONFIRMED') {
        throw new Error('Ya tienes una reserva activa para esta clase');
      }

      // 2. Row-Level Locking: Bloqueamos la fila de la clase específica usando MySQL puro FOR UPDATE
      const classRows = await tx.$queryRaw`
        SELECT id, max_capacity 
        FROM classes 
        WHERE id = ${Number(classId)} 
        FOR UPDATE;
      `;

      if (!classRows || classRows.length === 0) {
        throw new Error('Clase no encontrada');
      }

      const gymClass = classRows[0];

      // 3. Contar reservas confirmadas exactas
      const reservationsCountResult = await tx.$queryRaw`
        SELECT COUNT(*) as exactCount 
        FROM reservations 
        WHERE class_id = ${Number(classId)} AND status = 'CONFIRMED';
      `;
      // convert BigInt to Number
      const currentCount = Number(reservationsCountResult[0].exactCount);

      if (currentCount >= gymClass.max_capacity) {
        throw new Error('La clase ha alcanzado su capacidad máxima');
      }

      // 4. Crear o Reactivar Reserva
      if (existingRes) {
         return await tx.reservation.update({
          where: { id: existingRes.id },
          data: { status: 'CONFIRMED' }
        });
      } else {
         return await tx.reservation.create({
          data: {
            user_id: userId,
            class_id: Number(classId),
            status: 'CONFIRMED'
          }
        });
      }
    });

    res.status(200).json({ message: 'Reserva confirmada', reservation: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const cancelReservation = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const userId = req.user.id;

    const reservation = await prisma.reservation.findUnique({
      where: {
        user_id_class_id: {
          user_id: userId,
          class_id: Number(classId)
        }
      }
    });

    if (!reservation) {
      return res.status(400).json({ message: 'No tienes una reserva en esta clase' });
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' }
    });

    res.status(200).json({ message: 'Reserva cancelada' });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando reserva', error: error.message });
  }
};
