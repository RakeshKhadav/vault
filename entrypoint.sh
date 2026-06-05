#!/bin/sh
set -e
echo "--- RUNNING PRISMA MIGRATIONS ---"
if ! prisma migrate deploy > /tmp/prisma_migrate.log 2>&1; then
  echo "Prisma migrations failed with the following error:" >&2
  cat /tmp/prisma_migrate.log >&2
  exit 1
fi
echo "Prisma migrations ran successfully:"
cat /tmp/prisma_migrate.log

echo "--- STARTING NEXT.JS SERVER ---"
exec node server.js
