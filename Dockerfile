FROM nginx:1.13-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ./web/ /mnt/pizza-time
