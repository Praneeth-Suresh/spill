# Multi-stage Dockerfile for Spill feedback collection application
# Optimized for production deployment on Railway

# Stage 1: Build frontend and backend
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Pass build-time environment variables
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_DEFAULT_POINTS
ARG VITE_APP_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_DEFAULT_POINTS=$VITE_DEFAULT_POINTS
ENV VITE_APP_ID=$VITE_APP_ID

# Build frontend (Vite) and backend (esbuild)
RUN pnpm build

# Stage 2: Production runtime
FROM node:22-alpine AS runtime

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Copy necessary runtime files
COPY drizzle.config.ts ./

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
