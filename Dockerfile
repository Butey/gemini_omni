# Multi-stage build for production
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies using ci for exact versions and less memory
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Set memory limit for the build process to prevent OOM on small VPS
ENV NODE_OPTIONS="--max-old-space-size=512"

# Build the application
RUN npm run build

# Remove devDependencies before copying to the final image to save space
RUN npm prune --omit=dev --no-audit --no-fund && npm cache clean --force

# Final production image
FROM node:20-slim

WORKDIR /app

# Copy package info and production node_modules from builder
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Create storage directory for settings persistence
RUN mkdir -p /app/storage && chown -R node:node /app/storage

# Default port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

USER node

# Start the server
CMD ["node", "dist/server.cjs"]
