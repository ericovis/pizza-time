FROM python:3.6
ENV PYTHONUNBUFFERED 1
ADD entrypoint.sh /
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /app
ADD requirements.txt .
RUN pip install -r requirements.txt
ADD . .
