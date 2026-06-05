#!/bin/sh
set -e

echo "--- RUNNING PRISMA MIGRATIONS ---"
prisma migrate deploy

echo "--- STARTING NEXT.JS SERVER ---"
exec node server.js
