import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create app settings with registration enabled
  // First check if settings already exist
  let appSettings = await prisma.appSettings.findFirst();

  if (!appSettings) {
    appSettings = await prisma.appSettings.create({
      data: {
        registrationEnabled: true,
        requireApproval: false,
      },
    });
    console.log('✅ Created app settings:', {
      registrationEnabled: appSettings.registrationEnabled,
      requireApproval: appSettings.requireApproval,
    });
  } else {
    console.log('✅ App settings already exist');
  }

  // Create a test user
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash,
      role: 'admin',
    },
  });

  console.log('✅ Created user:', user.email);

  // Create a sample backup configuration
  const config = await prisma.backupConfig.create({
    data: {
      userId: user.id,
      name: 'Daily Documents Backup',
      enabled: true,
      sources: [
        {
          path: '/home/user/documents',
          excludePatterns: ['*.tmp', '*.log'],
          includePatterns: ['*.pdf', '*.docx'],
        },
      ],
      destination: {
        bucket: 'my-backup-bucket',
        region: 'us-east-1',
        prefix: 'backups/',
      },
      schedule: {
        cronExpression: '0 2 * * *',
        timezone: 'America/New_York',
      },
      options: {
        type: 'incremental',
        compression: true,
        compressionLevel: 6,
        encryption: true,
        retentionDays: 30,
      },
    },
  });

  console.log('✅ Created backup config:', config.name);

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch(e => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
