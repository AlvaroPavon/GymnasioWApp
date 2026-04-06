import express from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { validateSchema } from '../middlewares/validate.middleware.js';
import { registerSchema, loginSchema } from '../schemas/user.schema.js';

const router = express.Router();

router.post('/register', validateSchema(registerSchema), register);
router.post('/login', validateSchema(loginSchema), login);

export default router;
