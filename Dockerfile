# Stage 1: Builder
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build:production

# Prune development dependencies
RUN npm prune --production


# Stage 2: Production
FROM node:22-slim AS production

WORKDIR /app

# Copy production dependencies and built assets from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY package*.json ./

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs sales-buddy

# Change ownership of app directory
RUN chown -R sales-buddy:nodejs /app

# Switch to non-root user
USER sales-buddy

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Start the application
CMD ["npm", "start"]