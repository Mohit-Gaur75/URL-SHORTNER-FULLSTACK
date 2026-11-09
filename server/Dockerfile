# Stage 1: Build & Dependencies
FROM node:22-bookworm-slim AS base

# Install dumb-init to properly forward signals (SIGTERM, SIGINT) as PID 1
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Set file ownership to non-root user (node is a built-in user with UID 1000)
RUN chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose API port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production

# dumb-init forwards signals to node to support graceful shutdown
ENTRYPOINT ["dumb-init", "--"]

# Default command starts the API; can be overridden in docker-compose for the worker
CMD ["node", "server.js"]
