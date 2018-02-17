Pizza Time!
-----------------------------

A distributed web app for demo purposes

### Run the dev environment (local)

You need to have Docker and docker compose installed and configured on your computer.

To download/clone the repo and in the project's folder type:

```
docker-compose build
```

That will build the container. Once it's done run the bellow command to start the DB container:

```
docker-compose up db -d
```

Now run these commands to configure the database and load the initial data:

```
docker-compose run api python manage.py migrate
```

Now you are ready to run the app, to start the web server use this command:

```
docker-compose up
```

### Run the prod-ish environment (local)

You need to have Docker and docker compose installed and configured on your computer.

To download/clone the repo and in the project's folder type:

```
docker-compose --file=docker-compose.prod.yml build
```

That will build the container. Once it's done run the bellow command to start the DB container:

```
docker-compose --file=docker-compose.prod.yml up db -d
```

Now run these commands to configure the database and load the initial data:

```
docker-compose --file=docker-compose.prod.yml run api python manage.py migrate
```

Now you are ready to run the app, to start the web server use this command:

```
docker-compose --file=docker-compose.prod.yml up
```
