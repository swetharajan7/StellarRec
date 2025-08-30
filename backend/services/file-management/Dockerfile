FROM node:18-alpine

# Install system dependencies for image processing and document handling
RUN apk add --no-cache \
    vips-dev \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fileservice -u 1001

# Change ownership of the app directory
RUN chown -R fileservice:nodejs /app
USER fileservice

# Expose port
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3009/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]