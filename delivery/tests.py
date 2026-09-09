from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.models import Order, Pizza


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("jklimber", password="start123")

    def test_api_requires_authentication(self):
        response = self.client.get("/api/pizzas/get/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_obtain_token(self):
        response = self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "start123"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_bad_credentials_rejected(self):
        response = self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "wrong"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def _access_token(self):
        return self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "start123"}
        ).data["access"]

    def test_jwt_and_bearer_header_prefixes_both_work(self):
        token = self._access_token()
        for prefix in ("JWT", "Bearer"):
            with self.subTest(prefix=prefix):
                self.client.credentials(HTTP_AUTHORIZATION="%s %s" % (prefix, token))
                response = self.client.get("/api/pizzas/get/")
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_refresh_token(self):
        refresh = self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "start123"}
        ).data["refresh"]
        response = self.client.post("/api/auth/refresh/", {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


class OrderTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("jklimber", password="start123")
        self.other = User.objects.create_user("kimberly", password="start123")
        self.margherita = Pizza.objects.create(name="Margherita", price=Decimal("12.50"))
        self.pepperoni = Pizza.objects.create(name="Pepperoni", price=Decimal("14.00"))
        self.client.force_authenticate(user=self.user)

    def _pizza_url(self, pizza):
        return reverse("pizza-detail", args=[pizza.pk])

    def test_create_order(self):
        response = self.client.post(
            "/api/orders/new/",
            {
                "pizzas": [self._pizza_url(self.margherita)],
                "total": "17.50",
                "status": "Ordered",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.user, self.user)
        self.assertEqual(list(order.pizzas.all()), [self.margherita])

    def test_order_user_comes_from_request_not_payload(self):
        response = self.client.post(
            "/api/orders/new/",
            {
                "user": self.other.username,
                "pizzas": [self._pizza_url(self.pepperoni)],
                "total": "19.00",
                "status": "Ordered",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Order.objects.get(pk=response.data["id"]).user, self.user)

    def test_read_order_renders_names(self):
        order = Order.objects.create(user=self.user, total=Decimal("17.50"), status="Ordered")
        order.pizzas.add(self.margherita)

        response = self.client.get("/api/orders/get/%s/" % order.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"], "jklimber")
        self.assertEqual(response.data["pizzas"], ["Margherita"])

    def test_orders_get_is_read_only(self):
        response = self.client.post("/api/orders/get/", {})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class FixtureTests(APITestCase):
    """The seed data must keep loading, including the legacy password hashes."""

    fixtures = ["initial_data"]

    def test_seed_login_still_works(self):
        response = self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "start123"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_seed_pizzas_loaded(self):
        self.assertEqual(Pizza.objects.count(), 10)
