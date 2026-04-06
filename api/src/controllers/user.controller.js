import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

// ADMIN: Obtener todos los usuarios filtrados opcionalmente por rol
export const getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const whereClause = role ? { role: role.toUpperCase() } : {};
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true, name: true, email: true, role: true, profile_picture: true, phone: true, created_at: true }
    });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo usuarios', error: error.message });
  }
};

// ADMIN: Eliminar un usuario
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Evitar que el admin se borre a sí mismo
    if (Number(id) === req.user.id) {
      return res.status(403).json({ message: 'No puedes eliminarte a ti mismo' });
    }

    // Al eliminar usuario, Prisma debe eliminar reservas si cascading está activado, 
    // pero por seguridad las borramos manualmente si hay FK constraint activo.
    await prisma.reservation.deleteMany({ where: { user_id: Number(id) } });

    // Si es profesor, borrar sus clases o reasignar (en este lab lo borramos en cascada manual)
    const userRole = await prisma.user.findUnique({ where: { id: Number(id) }});
    if(userRole && userRole.role === 'TEACHER'){
      const susClases = await prisma.class.findMany({ where: { teacher_id: Number(id) }});
      const claseIds = susClases.map(c => c.id);
      await prisma.reservation.deleteMany({ where: { class_id: { in: claseIds } } });
      await prisma.class.deleteMany({ where: { teacher_id: Number(id) } });
    }

    await prisma.user.delete({ where: { id: Number(id) } });
    
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando usuario', error: error.message });
  }
};

// PROFILE: Actualizar mi foto (o ADMIN actualizar otras cuentas)
export const updateProfile = async (req, res) => {
  try {
    let newProfilePicture = undefined;
    
    // Si pasamos un archivo local (Multer)
    if (req.file) {
      newProfilePicture = `http://localhost:3000/uploads/profiles/${req.file.filename}`;
    }

    const targetUserId = req.params.id && req.user.role === 'ADMIN' ? Number(req.params.id) : req.user.id;
    const { email, phone } = req.body;

    const dataToUpdate = {};
    if (newProfilePicture) dataToUpdate.profile_picture = newProfilePicture;
    if (email) dataToUpdate.email = email;
    if (phone !== undefined) dataToUpdate.phone = phone; // Permite string vacio para borrar

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: dataToUpdate
    });
    
    res.json({ 
      id: updated.id, 
      name: updated.name, 
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      profile_picture: updated.profile_picture 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando perfil', error: error.message });
  }
};

// ADMIN: Crear un usuario nuevo completo
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Este email ya está en uso' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    let profile_picture = null;
    if (req.file) {
      profile_picture = `http://localhost:3000/uploads/profiles/${req.file.filename}`;
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: role || 'CLIENT',
        phone: phone || null,
        profile_picture
      }
    });

    res.status(201).json({ message: 'Usuario creado', id: newUser.id });
  } catch (error) {
    res.status(500).json({ message: 'Error creando usuario', error: error.message });
  }
};
