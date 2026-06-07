import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const dealership = await prisma.dealership.upsert({
    where: { id: 'seed-dealership' },
    update: {},
    create: {
      id: 'seed-dealership',
      name: 'Mercedes-Benz of Demo City',
    },
  });

  const passwordHash = await bcrypt.hash('changeme123', 12);

  await prisma.technician.upsert({
    where: { email: 'admin@dealership.com' },
    update: {},
    create: {
      email: 'admin@dealership.com',
      name: 'Service Manager',
      passwordHash,
      role: 'manager',
      isActive: true,
      dealershipId: dealership.id,
      consentAt: new Date(),
      consentVersion: '2026-06-07-v1',
    },
  });

  await prisma.technician.upsert({
    where: { email: 'tech@dealership.com' },
    update: {},
    create: {
      email: 'tech@dealership.com',
      name: 'Alex Technician',
      passwordHash,
      role: 'technician',
      isActive: true,
      dealershipId: dealership.id,
      consentAt: new Date(),
      consentVersion: '2026-06-07-v1',
    },
  });

  console.log('Seed complete.');
  console.log('  admin@dealership.com / changeme123 (manager)');
  console.log('  tech@dealership.com / changeme123 (technician)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());