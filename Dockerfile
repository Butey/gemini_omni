# Multi-stage build for production
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Final production image
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

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
