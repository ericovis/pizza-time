FROM node:8.9.4
RUN apt-get update && apt-get install -y nginx && npm install -g live-server \
  && ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log
ADD nginx.conf /etc/nginx/sites-enabled/default
WORKDIR /app
COPY . .
