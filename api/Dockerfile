FROM python:3.7 as base
ENV PYTHONUNBUFFERED 1
WORKDIR /app
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh && pip install pipenv pip --upgrade
ENTRYPOINT ["/entrypoint.sh"]
COPY Pipfile Pipfile.lock ./
RUN pipenv install --system
COPY . .

FROM base as dev
RUN pipenv install --system --dev

