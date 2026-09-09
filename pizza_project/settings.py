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

# The frontend is served from a different origin than the API (its own nginx
# container), so CORS is always in play. Allow-all stays the default for the demo; set
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
DEMO_USERNAME = os.environ.get("DEMO_USERNAME", "jklimber")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "start123")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

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

# Only the admin and the DRF browsable API are served from here; the pizza
# frontend is a separate container (see frontend/).
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
