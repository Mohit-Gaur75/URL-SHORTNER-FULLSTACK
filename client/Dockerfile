# Stage 1: Build static assets using Vite
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copy dependency specifications first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Pass build-time environment variables needed by Vite
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Copy source code and build the production bundle
COPY . .
RUN npm run build

# Stage 2: Serve static files with high-performance Nginx
FROM nginx:1.27-alpine

# Remove default Nginx welcome site
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration (handles SPA fallback routing & gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose web port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
