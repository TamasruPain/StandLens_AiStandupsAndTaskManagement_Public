import { PrismaClient, TeamRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Demo Users
  const alex = await prisma.user.upsert({
    where: { email: 'alex@example.com' },
    update: {},
    create: {
      email: 'alex@example.com',
      name: 'Alex Rivera (Lead)',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: {},
    create: {
      email: 'sarah@example.com',
      name: 'Sarah Chen (Dev)',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    },
  });

  const mike = await prisma.user.upsert({
    where: { email: 'mike@example.com' },
    update: {},
    create: {
      email: 'mike@example.com',
      name: 'Mike Ross (Dev)',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
    },
  });

  // 2. Create Demo Team
  const team = await prisma.team.upsert({
    where: { inviteCode: 'ACME-DEV-123' },
    update: {},
    create: {
      name: 'Acme Frontend Devs',
      companyName: 'Acme Corp',
      inviteCode: 'ACME-DEV-123',
      discoverable: true,
    },
  });

  // 3. Create Team Memberships
  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: alex.id, teamId: team.id } },
    update: {},
    create: {
      userId: alex.id,
      teamId: team.id,
      role: TeamRole.OWNER,
    },
  });

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: sarah.id, teamId: team.id } },
    update: {},
    create: {
      userId: sarah.id,
      teamId: team.id,
      role: TeamRole.ADMIN,
    },
  });

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: mike.id, teamId: team.id } },
    update: {},
    create: {
      userId: mike.id,
      teamId: team.id,
      role: TeamRole.MEMBER,
    },
  });

  // 4. Create Sample Standups for Today
  const today = new Date();

  await prisma.standup.upsert({
    where: {
      userId_teamId_standupDate: {
        userId: alex.id,
        teamId: team.id,
        standupDate: today,
      },
    },
    update: {},
    create: {
      userId: alex.id,
      teamId: team.id,
      yesterday: 'Configured NestJS API and created Prisma schema for StandLens.',
      today: 'Integrating BetterAuth and setting up Team module endpoints.',
      blockers: 'None',
      standupDate: today,
    },
  });

  await prisma.standup.upsert({
    where: {
      userId_teamId_standupDate: {
        userId: sarah.id,
        teamId: team.id,
        standupDate: today,
      },
    },
    update: {},
    create: {
      userId: sarah.id,
      teamId: team.id,
      yesterday: 'Designed Figma wireframes for Dashboard and Team view.',
      today: 'Setting up Next.js 16 app layout and shadcn/ui components.',
      blockers: 'Waiting for API endpoints definition.',
      standupDate: today,
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
