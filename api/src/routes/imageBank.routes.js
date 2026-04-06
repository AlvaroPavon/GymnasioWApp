import express from 'express';
import { getImages, addImage, deleteImage } from '../controllers/imageBank.controller.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, authorizeRole(['ADMIN']), getImages);
router.post('/', authenticateToken, authorizeRole(['ADMIN']), addImage);
router.delete('/:id', authenticateToken, authorizeRole(['ADMIN']), deleteImage);

export default router;
