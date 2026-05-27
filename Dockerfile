FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --prefix server

# Copy client source
COPY client ./client

# Build client
RUN npm ci --prefix client && npm run build --prefix client

# Copy server code
COPY server ./server

# Start server
EXPOSE 3001
CMD ["npm", "start", "--prefix", "server"]
