# Use Bun 1.3 as the base image
FROM oven/bun:1.3

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Expose port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Run the server
CMD ["bun", "run", "server.tsx"]


