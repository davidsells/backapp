#!/bin/bash

# Database setup script for Docker Compose environment

set -e

echo "🔧 Setting up database..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
while ! docker-compose exec -T db pg_isready -U backapp > /dev/null 2>&1; do
  sleep 1
done

echo "✅ Database is ready!"

# Generate Prisma client
echo "📦 Generating Prisma client..."
docker-compose exec app npm run db:generate

# Run migrations
echo "🔄 Running database migrations..."
docker-compose exec app npm run db:migrate

echo "✅ Database setup complete!"
