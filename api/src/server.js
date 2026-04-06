import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import classRoutes from './routes/class.routes.js';
import userRoutes from './routes/user.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import imageBankRoutes from './routes/imageBank.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Archivos estáticos Locales Multer
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Main route
app.get('/', (req, res) => {
  res.json({ message: 'Gym Management API is running perfectly!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
