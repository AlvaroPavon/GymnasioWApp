import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.status(401).json({ message: 'Token no proporcionado' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    // Verificamos que el usuario siga existiendo en DB
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    
    if (!dbUser) {
      return res.status(403).json({ message: 'El usuario ya no existe' });
    }

    req.user = dbUser;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado' });
  }
};

export const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes los permisos necesarios' });
    }
    next();
  };
};
