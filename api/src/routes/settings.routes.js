import express from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.middleware.js';
import { uploadProfile } from '../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/', getSettings);
router.put('/', authenticateToken, authorizeRole(['ADMIN']), uploadProfile.single('hero'), updateSettings);

export default router;
