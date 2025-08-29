FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001

# Change ownership of the app directory
RUN chown -R appuser:nodejs /app
USER appuser

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Start the application
CMD ["npm", "start"]