# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN npx prisma generate
# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build
# Compile TypeScript seed-admin script to JavaScript
RUN npx tsc seed-admin.ts --noEmit false --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck true --outDir dist

# Stage 3: Run the application
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED 1

# Install system-level FFmpeg for media processing
RUN apk add --no-cache ffmpeg

# Create directories and set permissions
RUN mkdir -p .next && chown node:node .next

# Copy standalone build output
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Copy Prisma migrations and schema so migrate deploy works in the container
COPY --from=builder --chown=node:node /app/prisma ./prisma
# Copy compiled seeding scripts and load-env
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy and configure entrypoint script
COPY --from=builder --chown=node:node /app/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
