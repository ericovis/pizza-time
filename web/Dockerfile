FROM node:8.9.4
RUN apt-get install -y nginx
ENV PYTHONUNBUFFERED 1
ADD entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /app
RUN npm install -g live-server
COPY . .
