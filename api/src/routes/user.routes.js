import express from 'express';
import { getUsers, deleteUser, updateProfile, createUser } from '../controllers/user.controller.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware.js';
import { uploadProfile } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Rutas genéricas
router.put('/profile', authenticateToken, uploadProfile.single('profile'), updateProfile);

// Rutas estrictamente para administradores
router.get('/', authenticateToken, authorizeRole(['ADMIN']), getUsers);
router.post('/', authenticateToken, authorizeRole(['ADMIN']), uploadProfile.single('profile'), createUser);
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN']), deleteUser);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN']), updateProfile);

export default router;
