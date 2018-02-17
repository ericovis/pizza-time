FROM node:8.9.4
RUN apt-get update && apt-get install -y nginx && npm install -g live-server
ADD nginx.conf /etc/nginx/sites-enabled/default
WORKDIR /app
COPY . .
