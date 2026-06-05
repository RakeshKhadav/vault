#!/usr/bin/env bash
# render-build.sh — Render Build Command
# This script runs during Render's build phase.
set -o errexit

echo "--- INSTALLING DEPENDENCIES ---"
npm ci

echo "--- GENERATING PRISMA CLIENT ---"
npx prisma generate

echo "--- SYNCING PRISMA SCHEMA ---"
npx prisma db push --accept-data-loss

echo "--- BUILDING NEXT.JS ---"
npm run build
