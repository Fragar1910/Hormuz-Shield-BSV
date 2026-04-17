# HormuzShield - Multi-Agent System
# ==================================
# Builds all agents and UI in a single container for deployment

FROM node:20-alpine AS builder

# Install dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/risk-oracle/package*.json ./packages/risk-oracle/
COPY packages/insurer-pool/package*.json ./packages/insurer-pool/
COPY packages/shipowner/package*.json ./packages/shipowner/
COPY packages/claims-verifier/package*.json ./packages/claims-verifier/
COPY packages/hormuz-ui/package*.json ./packages/hormuz-ui/

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine

# Install PM2 for process management
RUN npm install -g pm2

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=builder /app /app

# Expose ports for all agents and UI
EXPOSE 3001 3002 3003 3004 5173

# Copy PM2 ecosystem file
COPY ecosystem.config.js .

# Start all agents with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
