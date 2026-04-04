import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import classRoutes from './routes/class.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración estricta de CORS
app.use(cors({
  origin: '*', // En producción debería configurarse con el dominio del frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);

// Main route
app.get('/', (req, res) => {
  res.json({ message: 'Gym Management API is running perfectly!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
