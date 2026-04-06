import { prisma } from '../lib/prisma.js';

export const getSettings = async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: 1,
          app_name: "GymSystem Pro",
          hero_image: "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
        }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { app_name } = req.body;
    let hero_image = undefined;

    if (req.file) {
      hero_image = `http://localhost:3000/uploads/profiles/${req.file.filename}`;
    }

    const data = {};
    if (app_name) data.app_name = app_name;
    if (hero_image) data.hero_image = hero_image;

    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        id: 1,
        app_name: app_name || "GymSystem Pro",
        hero_image: hero_image || "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
      }
    });

    res.json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
};
