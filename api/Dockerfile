FROM python:3.6
ENV PYTHONUNBUFFERED 1
WORKDIR /app
ADD requirements.txt .
RUN pip install -r requirements.txt
ADD . .
