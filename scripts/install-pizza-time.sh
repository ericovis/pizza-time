#!/bin/bash
# EC2 user-data script for the API tier (Amazon Linux 2023).
# Fill in the DATABASE_* values to point at your RDS Postgres instance.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/cloudacademy/pizza-time}"
REPO_BRANCH="${REPO_BRANCH:-master}"

export DEBUG=false
export SECRET_KEY=
export ALLOWED_HOSTS='*'
export DATABASE_NAME=
export DATABASE_USER=
export DATABASE_HOST=
export DATABASE_PORT=5432
export DATABASE_PASSWORD=

dnf update -y
dnf install -y git python3.12 python3.12-pip libpq-devel gcc

git clone --branch "$REPO_BRANCH" "$REPO_URL" /opt/pizza-time
cd /opt/pizza-time

python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

.venv/bin/python manage.py migrate --noinput
.venv/bin/python manage.py collectstatic --no-input

.venv/bin/gunicorn pizza_project.wsgi:application --bind 0.0.0.0:80 --workers 3
