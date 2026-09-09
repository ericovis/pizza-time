# Build the Vite bundle, then serve it from nginx. The API base URL is NOT
# baked in: docker-entrypoint.sh regenerates /config.js from $API_URL on boot.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY docker-entrypoint.sh /docker-entrypoint.d/40-pizza-config.sh
RUN chmod +x /docker-entrypoint.d/40-pizza-config.sh

EXPOSE 80
