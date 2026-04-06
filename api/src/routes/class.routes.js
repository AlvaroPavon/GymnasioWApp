import express from 'express';
import { getClasses, createClass, reserveClass, cancelReservation, deleteClass, updateClass } from '../controllers/class.controller.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware.js';
import { validateSchema } from '../middlewares/validate.middleware.js';
import { classCreateSchema } from '../schemas/class.schema.js';

const router = express.Router();

// Todos los usuarios logueados pueden ver clases
router.get('/', authenticateToken, getClasses);

// Solo ADMIN puede crear clases (validado por zod) y eliminarlas
router.post('/', authenticateToken, authorizeRole(['ADMIN']), validateSchema(classCreateSchema), createClass);
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN']), deleteClass);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'TEACHER']), updateClass);

// CLIENT puede reservar o cancelar reservas
router.post('/:id/reserve', authenticateToken, authorizeRole(['CLIENT']), reserveClass);
router.post('/:id/cancel', authenticateToken, authorizeRole(['CLIENT']), cancelReservation);

export default router;
