#!/usr/bin/env node

/**
 * Script to run the size_assessment_requests migration
 * Run this with: node scripts/run-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Checking if size_assessment_requests table exists...');

    // Try to query the table
    try {
      await prisma.$queryRaw`SELECT 1 FROM size_assessment_requests LIMIT 1`;
      console.log('✓ Table already exists, no migration needed');
      return;
    } catch (error) {
      if (!error.message.includes('does not exist')) {
        throw error;
      }
      console.log('Table does not exist, running migration...');
    }

    // Read the migration SQL
    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/20250121000000_add_size_assessment_requests/migration.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Executing ${statements.length} SQL statements...`);

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    // Record the migration in _prisma_migrations table
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (
        id,
        checksum,
        finished_at,
        migration_name,
        logs,
        rolled_back_at,
        started_at,
        applied_steps_count
      ) VALUES (
        gen_random_uuid(),
        '00000000000000000000000000000000',
        NOW(),
        '20250121000000_add_size_assessment_requests',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT (migration_name) DO NOTHING
    `;

    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
