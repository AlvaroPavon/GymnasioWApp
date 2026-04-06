import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Creando banco de imágenes inicial...");

  await prisma.imageBank.createMany({
    data: [
      { keyword: 'spinning', image_url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=1000' },
      { keyword: 'yoga', image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=1000' },
      { keyword: 'crossfit', image_url: 'https://images.unsplash.com/photo-1517343985841-f8b2d66e010b?auto=format&fit=crop&q=80&w=1000' },
      { keyword: 'boxeo', image_url: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&q=80&w=1000' },
      { keyword: 'zumba', image_url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=1000' }
    ],
    skipDuplicates: true
  });

  console.log("Banco de imágenes configurado.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
