import express from 'express';
import { getClasses, createClass, reserveClass, cancelReservation } from '../controllers/class.controller.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Todos los usuarios logueados pueden ver clases
router.get('/', authenticateToken, getClasses);

// Solo ADMIN puede crear clases
router.post('/', authenticateToken, authorizeRole(['ADMIN']), createClass);

// CLIENT puede reservar o cancelar reservas
router.post('/:id/reserve', authenticateToken, authorizeRole(['CLIENT']), reserveClass);
router.post('/:id/cancel', authenticateToken, authorizeRole(['CLIENT']), cancelReservation);

export default router;
