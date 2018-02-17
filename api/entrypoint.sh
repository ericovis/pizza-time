#!/bin/bash

set -e

start-dev (){
  sleep 6
  python /app/manage.py runserver 0.0.0.0:8000
}

if [[ $1 = "start-dev" ]]; then
  start-dev
fi

exec "$@"
