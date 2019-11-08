FROM node:10 as dev
WORKDIR /app
RUN npm install -g live-server 
COPY . .

FROM nginx:latest as prod
WORKDIR /app
ADD nginx.conf /etc/nginx/sites-enabled/default
COPY . .
