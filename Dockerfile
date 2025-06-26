# Use Node.js 22 LTS
FROM node:22-slim AS base

# Set working directory
WORKDIR /app

# Install curl for health checks and update package list
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - use standard Linux instead of Alpine for DuckDB compatibility
FROM node:22-slim AS production

# Set working directory
WORKDIR /app

# Install curl for health checks and update package list
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from base stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/public ./public

# Create data directory for database
RUN mkdir -p /app/data

# Create non-root user (Debian syntax)
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs sales-buddy

# Change ownership of app directory
RUN chown -R sales-buddy:nodejs /app

# Switch to non-root user
USER sales-buddy

# Expose port (Koyeb uses 8000, local uses 3000)
EXPOSE 8000
EXPOSE 3000

# Health check (check both ports)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Start the application
CMD ["npm", "start"]