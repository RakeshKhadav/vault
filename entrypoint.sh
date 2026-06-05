#!/bin/sh
set -e

echo "--- RUNNING PRISMA MIGRATIONS ---"
npx prisma migrate deploy

echo "--- STARTING NEXT.JS SERVER ---"
exec node server.js
