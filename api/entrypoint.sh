#!/bin/bash

set -e

start-dev (){
  sleep 6
  python /app/manage.py runserver 0.0.0.0:8000
}

prod-server (){
  mkdir -p /app/static
  python manage.py collectstatic --noinput
  uwsgi --http 0.0.0.0:8000 --module pizza_time.wsgi --uid app -p 20 --static-map /static=/app/static
}

if [[ $1 = "start-dev" ]]; then
  start-dev
elif [[ $1 = "prod-server" ]]; then
  prod-server
fi

exec "$@"
