from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.auth import STAFF_REFUSED
from delivery.models import Order, OrderItem, Pizza


class SeedCommandTests(APITestCase):
    """seed_demo runs on every boot, so it has to be safe to run twice."""

    def setUp(self):
        call_command("seed_demo", stdout=StringIO())

    def test_catalog_is_seeded(self):
        self.assertEqual(Pizza.objects.count(), 11)
        self.assertEqual(Pizza.objects.get(slug="pepperoni").price, Decimal("12.23"))

    def test_menu_endpoint_serves_the_catalog_without_a_token(self):
        response = self.client.get("/api/pizzas/get/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 11)

    def test_demo_login_works(self):
        response = self.client.post(
            "/api/auth/", {"username": "jklimber", "password": "start123"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_demo_user_has_four_orders(self):
        demo = User.objects.get(username="jklimber")
        self.assertEqual(Order.objects.filter(user=demo).count(), 4)
        self.assertEqual(
            Order.objects.filter(user=demo).first().status,
            Order.Status.OUT_FOR_DELIVERY,
        )

    def test_demo_user_only_sees_their_own_orders(self):
        self.client.force_authenticate(user=User.objects.get(username="jklimber"))
        response = self.client.get("/api/orders/get/")
        self.assertEqual(len(response.data), 4)
        self.assertEqual({o["user"] for o in response.data}, {"jklimber"})

    def test_other_customers_have_their_own_orders(self):
        for username in ("kimberly", "carlos"):
            with self.subTest(username=username):
                self.assertEqual(
                    Order.objects.filter(user__username=username).count(), 1
                )

    def test_staff_user_is_created_and_cannot_use_the_frontend(self):
        admin = User.objects.get(username="admin")
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

        response = self.client.post(
            "/api/auth/", {"username": "admin", "password": "admin123"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(str(response.data["detail"]), STAFF_REFUSED)

    def test_totals_include_the_delivery_fee(self):
        # 9 days ago: Capricciosa 11.00 + Vegetarian 13.23 + 5.00 delivery.
        oldest = Order.objects.filter(user__username="jklimber").last()
        self.assertEqual(oldest.total, Decimal("29.23"))

    def test_second_run_creates_nothing(self):
        before = (
            Pizza.objects.count(),
            User.objects.count(),
            Order.objects.count(),
            OrderItem.objects.count(),
        )
        call_command("seed_demo", stdout=StringIO())
        after = (
            Pizza.objects.count(),
            User.objects.count(),
            Order.objects.count(),
            OrderItem.objects.count(),
        )
        self.assertEqual(before, after)
