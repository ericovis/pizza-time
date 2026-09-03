Pizza Time!
===========

A small pizza-ordering demo app — a Django REST Framework API and an AngularJS
frontend — originally built as the deployable workload for the Cloud Academy
[SysOps Administrator — Associate for AWS](https://cloudacademy.com/learning-paths/aws-sysops-7/)
learning path.

The API and the frontend are separate services. Locally they run as separate
containers; in the course's AWS exercises the frontend is uploaded to S3 and
served through CloudFront while the API runs on EC2 or Elastic Beanstalk.

Stack: Python 3.12, Django 5.2, Django REST Framework, PostgreSQL, AngularJS 1.5.

Running locally
---------------

You need Docker with Compose v2.

```
docker compose up --build
```

That starts three containers: `db` (Postgres), `api` (Django, migrations run
automatically on boot) and `frontend` (nginx).

Load the seed data the first time:

```
docker compose exec api python manage.py loaddata initial_data
```

Then open:

- Frontend — http://localhost:8080
- API (browsable) — http://localhost:8000/api/
- Admin — http://localhost:8000/admin/

Seed login: `jklimber` / `start123`.

Configuration lives in environment variables; copy `.env.example` to `.env` to
override any of them. Compose picks `.env` up automatically.

Tests
-----

```
docker compose run --rm api python manage.py test
docker compose run --rm api python manage.py test delivery.tests.OrderTests
```

The API
-------

Every endpoint requires authentication. `POST /api/auth/` with a username and
password returns a simplejwt `access`/`refresh` pair; send the access token as
`Authorization: Bearer <token>` (the older `JWT <token>` prefix is also
accepted).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/` | POST | obtain an access/refresh token pair |
| `/api/auth/refresh/` | POST | exchange a refresh token for a new access token |
| `/api/pizzas/get/` | GET, POST | the pizza catalog |
| `/api/orders/get/` | GET | orders, rendered with pizza and user names |
| `/api/orders/new/` | POST | create an order; pizzas are posted as hyperlinks |
| `/api/users/` | GET | read-only user list |

Orders are always created for the authenticated caller — a `user` in the
request body is ignored.

The frontend
------------

One copy of the app, in [frontend/](/frontend), served by nginx. It reads its
API base URL from `window.PIZZA_API_URL` in
[static/js/config.js](/frontend/static/js/config.js), which the container
rewrites on start-up from the `API_URL` environment variable:

```
API_URL=https://api.example.com docker compose up frontend
```

### Hosting it on S3 instead

The folder is plain static files, so it can go straight to a bucket. Edit
`static/js/config.js` to point at your API, then:

```
aws s3 sync frontend/ s3://your-bucket/ --exclude 'Dockerfile' --exclude 'nginx.conf' --exclude 'docker-entrypoint.sh' --exclude '.dockerignore'
```

Enable static website hosting on the bucket, and put CloudFront in front of it
if you are demonstrating the CDN. The API needs to allow the bucket's origin —
`CORS_ALLOWED_ORIGINS` does that (it defaults to allowing everything).

Deploying the API
-----------------

### Elastic Beanstalk

Install and configure the CLIs:

```
pip install awscli awsebcli
aws configure
```

- Create an RDS **PostgreSQL** instance
- Create an Elastic Beanstalk application and an environment on a Python 3.12
  platform
- Fill in the environment variables in
  [.ebextensions/django.config](/.ebextensions/django.config) — at minimum
  `SECRET_KEY`, `ALLOWED_HOSTS` and the `DATABASE_*` values
- Then:

```
eb init
git add .
eb deploy --staged
```

### EC2 instances

[scripts/install-pizza-time.sh](/scripts/install-pizza-time.sh) is an Amazon
Linux 2023 user-data script for the API tier. Fill in the `DATABASE_*` and
`SECRET_KEY` exports before using it in an instance or launch template.

### Monitoring

[scripts/install_custom_monitoring.sh](/scripts/install_custom_monitoring.sh)
installs the CloudWatch monitoring scripts on a cron, and
[scripts/send_custom_metrics.sh](/scripts/send_custom_metrics.sh) pushes a
page-load-time custom metric. Both hardcode a region and hostname; change them
to match your environment.

### Networking

[scripts/pizza-time-cloud-formation.template](/scripts/pizza-time-cloud-formation.template)
builds the VPC, subnets, NACLs, ELB and autoscaling group used in the course.
It has not been modernized — it still describes a classic ELB and derives its
logical names from a specific set of exported AWS resource IDs.

Further material
----------------

  - [Whitepaper: Overview of security processes](http://d0.awsstatic.com/whitepapers/Security/AWS%20Security%20Whitepaper.pdf)
  - [Whitepaper: Amazon Virtual Private Cloud Connectivity Options](http://media.amazonwebservices.com/AWS_Amazon_VPC_Connectivity_Options.pdf)
  - [Whitepaper: Operational checklists for AWS (Preparing for security assessments)](http://media.amazonwebservices.com/AWS_Operational_Checklists.pdf)
  - [Page: Troubleshooting EC2 connectivity issues](https://aws.amazon.com/premiumsupport/knowledge-center/linux-credentials-error/)
  - [Video: How should I connect to my Amazon virtual private cloud?](https://aws.amazon.com/premiumsupport/knowledge-center/connect-vpc/)
  - [Video: How do I troubleshoot problems connecting to my EC2 Linux instance using SSH?](https://aws.amazon.com/premiumsupport/knowledge-center/ec2-linux-ssh-troubleshooting/)
  - [Page: General FAQs](https://aws.amazon.com/premiumsupport/knowledge-center/)
