import { prisma } from '../lib/prisma.js';

export const getImages = async (req, res) => {
  try {
    const images = await prisma.imageBank.findMany();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addImage = async (req, res) => {
  try {
    const { keyword, image_url } = req.body;
    const img = await prisma.imageBank.create({
      data: { keyword: keyword.toLowerCase(), image_url }
    });
    res.json(img);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteImage = async (req, res) => {
  try {
    await prisma.imageBank.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Imagen eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
