#!/bin/sh
set -e

echo "Starting BackApp..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || \
     psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
    echo "PostgreSQL is ready!"
    break
  fi

  attempt=$((attempt + 1))
  echo "PostgreSQL is unavailable - sleeping (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Failed to connect to PostgreSQL after $max_attempts attempts"
  exit 1
fi

# Run database migrations
echo "Running database migrations..."
if [ -f "/app/node_modules/.bin/prisma" ]; then
  npx prisma migrate deploy
else
  echo "Prisma not found, skipping migrations"
fi

# Seed database if needed (development only)
if [ "$NODE_ENV" = "development" ]; then
  echo "Development environment detected"
  if [ -f "/app/prisma/seed.js" ] || [ -f "/app/prisma/seed.ts" ]; then
    echo "Running database seed..."
    npx prisma db seed || echo "No seed script defined"
  fi
fi

echo "Starting application..."
exec "$@"
