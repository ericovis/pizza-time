"""
Django settings for pizza_project.

Configuration is read from environment variables so the same image can run
locally under Docker Compose and on a server. See .env.example for the full
list and docker-compose.yml for the local development values.
"""

import os
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


# SECURITY WARNING: the fallback is a development convenience. Set SECRET_KEY in
# any environment that is not your laptop.
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-secret-key-change-me")

DEBUG = env_bool("DEBUG", True)

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "*")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

# Under Docker Compose the frontend has its own nginx container and its own
# origin, so CORS is in play; served from FRONTEND_DIST below it is same-origin
# and CORS never applies. Allow-all stays the default for the demo; set
# CORS_ALLOWED_ORIGINS to lock it down.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = not CORS_ALLOWED_ORIGINS
# Credentials are only offered to an explicitly listed origin. The frontend
# authenticates with a Bearer token, never a cookie, so it does not need them;
# allowing them while every origin is permitted would let any website read an
# admin's session-authenticated responses (the browsable API uses session auth).
CORS_ALLOW_CREDENTIALS = bool(CORS_ALLOWED_ORIGINS)


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "delivery",
]

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
}

# --- Demo data -------------------------------------------------------------
# The delivery fee the server adds to every non-empty order. Authoritative:
# the frontend keeps its own copy only for the cart preview.
DELIVERY_FEE = Decimal(os.environ.get("DELIVERY_FEE", "5.00"))

# Credentials created by the seed_demo management command, which runs on every
# boot. The customer login is printed on the sign-in screen.
DEMO_USERNAME = os.environ.get("DEMO_USERNAME", "pizza")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "pizza")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "pizza-admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "pizza-admin")

SIMPLE_JWT = {
    # "JWT" is what the original djangorestframework-jwt used; "Bearer" is
    # simplejwt's default and what the React frontend sends.
    "AUTH_HEADER_TYPES": ("Bearer", "JWT"),
    # A demo session should not log itself out mid-sentence. The frontend
    # still refreshes once on a 401 before giving up.
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    # Refuses staff accounts and adds `username` to the response; see
    # delivery/auth.py.
    "TOKEN_OBTAIN_SERIALIZER": "delivery.auth.CustomerTokenObtainPairSerializer",
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves the admin's and the browsable API's static files, and — when
    # FRONTEND_DIST points at a build — the single-page app itself, at the web
    # root. Nothing else in the image can serve a file: gunicorn does not.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "pizza_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "pizza_project.wsgi.application"


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DATABASE_NAME", "pizza"),
        "USER": os.environ.get("DATABASE_USER", "pizza"),
        "PASSWORD": os.environ.get("DATABASE_PASSWORD", ""),
        "HOST": os.environ.get("DATABASE_HOST", "localhost"),
        "PORT": os.environ.get("DATABASE_PORT", "5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# The admin's and the browsable API's own assets. `collectstatic` runs in the
# image build; WhiteNoise serves what it collected.
STATIC_URL = "static/"
# Outside the repo in the image (STATIC_ROOT=/srv/static), because /code is a
# bind mount in development and would hide the manifest the storage below
# needs.
STATIC_ROOT = Path(os.environ.get("STATIC_ROOT", BASE_DIR / "staticfiles"))
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Hashed names plus a manifest, so /static/ can be cached forever. Every
    # file the admin references must exist at boot, which is why the image
    # runs collectstatic and nothing serves static from a bind mount.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# --- The single-page app, when this image carries it ------------------------
# One origin in production: the Dockerfile builds frontend/ and leaves the
# bundle here, and WhiteNoise serves that directory at the web root (index.html
# for "/", the fingerprinted assets under /assets/ and /fonts/). The app is
# hash-routed, so "/" is the only HTML path a browser ever asks for and no
# catch-all view is needed. Unset — or pointing at a directory that does not
# exist, which is what the development bind mount over /code produces — leaves
# Django serving nothing but /api/, /admin/ and /static/, exactly as before,
# and the frontend container answers on its own port.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "")
if FRONTEND_DIST and Path(FRONTEND_DIST).is_dir():
    WHITENOISE_ROOT = FRONTEND_DIST
    WHITENOISE_INDEX_FILE = True

# --- Behind a TLS-terminating proxy -----------------------------------------
# Caramelo's edge (and any other reverse proxy) answers 443 and forwards over
# plain HTTP, so Django only knows the request was secure if it is told. Off by
# default: nothing in front of Docker Compose sets these headers, and trusting
# a header the client could have sent itself would be a lie about the
# connection. Turn it on wherever a proxy you control terminates TLS.
TRUST_PROXY = env_bool("TRUST_PROXY")
if TRUST_PROXY:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # With the scheme known, the admin's CSRF origin check passes on its own
    # and the session cookie can be marked secure.
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
