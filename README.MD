Pizza Time!
-----------------------------

A distributed web app for demo purposes

### Run the dev environment (local)

You need to have Docker and docker compose installed and configured on your computer.

To download/clone the repo and in the project's folder type:

```
docker-compose build
```

That will build the container. Once it's done run the bellow command to start the containers:

```
docker-compose up -d
```

Now run these commands to configure the database and load the initial data:

```
docker-compose exec api python manage.py migrate
```

### Run the prod-ish environment (local)

You need to have Docker and docker compose installed and configured on your computer.

To download/clone the repo and in the project's folder type:

```
docker-compose --file=docker-compose.prod.yml build
```

That will build the container. Once it's done run the bellow command to start the containers:

```
docker-compose --file=docker-compose.prod.yml up -d
```

Now run these commands to configure the database and load the initial data:

```
docker-compose --file=docker-compose.prod.yml exec api python manage.py migrate
```
