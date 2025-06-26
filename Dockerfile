# Use Node.js 22 LTS
FROM node:22-alpine AS base

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from base stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/public ./public

# Create data directory for database
RUN mkdir -p /app/data

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sales-buddy -u 1001

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