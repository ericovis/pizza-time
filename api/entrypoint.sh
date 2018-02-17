#!/bin/bash

set -e

start-dev (){
  sleep 6
  python /app/manage.py runserver 0.0.0.0:8000
}

prod-server (){
  uwsgi --http 0.0.0.0:8000 --module pizza_time.wsgi --uid app -p 15
}

if [[ $1 = "start-dev" ]]; then
  start-dev
elif [[ $1 = "prod-server" ]]; then
  prod-server
fi

exec "$@"
