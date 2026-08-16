#!/bin/sh
set -e

echo "🚀 [Docker Entrypoint] Synchronizing Prisma database schema..."
npx prisma db push --skip-generate

echo "🌟 [Docker Entrypoint] Starting application process..."
exec "$@"
