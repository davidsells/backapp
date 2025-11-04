import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create test user
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

  console.log('Created user:', user.email);

  // Create sample backup config
  const config = await prisma.backupConfig.create({
    data: {
      userId: user.id,
      name: 'Sample Backup',
      enabled: false,
      sources: [
        {
          path: '/home/user/documents',
          excludePatterns: ['*.tmp', 'node_modules'],
          includePatterns: ['*'],
        },
      ],
      destination: {
        bucket: 'my-backup-bucket',
        region: 'us-east-1',
        prefix: 'backups/',
      },
      schedule: {
        cronExpression: '0 2 * * *', // Daily at 2 AM
        timezone: 'America/New_York',
      },
      options: {
        type: 'incremental',
        compression: true,
        compressionLevel: 6,
        encryption: false,
        retentionDays: 30,
      },
    },
  });

  console.log('Created backup config:', config.name);

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
