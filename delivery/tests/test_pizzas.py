from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.models import Pizza


class PizzaTests(APITestCase):
    """The catalog is public to read and staff-only to change."""

    def setUp(self):
        self.customer = User.objects.create_user("jklimber", password="start123")
        self.staff = User.objects.create_user(
            "admin", password="admin123", is_staff=True
        )
        self.margherita = Pizza.objects.create(
            name="Margherita", slug="margherita", price=Decimal("12.50")
        )
        self.retired = Pizza.objects.create(
            name="Hawaiian", slug="hawaiian", price=Decimal("10.00"), is_active=False
        )

    def test_anonymous_can_read_the_menu(self):
        response = self.client.get("/api/pizzas/get/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([p["slug"] for p in response.data], ["margherita"])

    def test_customer_can_read_the_menu(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get("/api/pizzas/get/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_menu_fields(self):
        response = self.client.get("/api/pizzas/get/%s/" % self.margherita.pk)
        self.assertEqual(
            set(response.data),
            {"id", "slug", "name", "price", "toppings", "description", "url"},
        )

    def test_inactive_pizzas_are_hidden_from_customers(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get("/api/pizzas/get/")
        self.assertNotIn("hawaiian", [p["slug"] for p in response.data])

        detail = self.client.get("/api/pizzas/get/%s/" % self.retired.pk)
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_pizzas_are_visible_to_staff(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/pizzas/get/")
        self.assertIn("hawaiian", [p["slug"] for p in response.data])

    def test_customer_cannot_change_the_menu(self):
        self.client.force_authenticate(user=self.customer)
        detail = "/api/pizzas/get/%s/" % self.margherita.pk
        payload = {"name": "Free", "slug": "free", "price": "0.01"}

        for method, url in (
            (self.client.post, "/api/pizzas/get/"),
            (self.client.put, detail),
            (self.client.patch, detail),
            (self.client.delete, detail),
        ):
            with self.subTest(method=method.__name__):
                response = method(url, payload)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.margherita.refresh_from_db()
        self.assertEqual(self.margherita.price, Decimal("12.50"))

    def test_anonymous_cannot_change_the_menu(self):
        response = self.client.post(
            "/api/pizzas/get/", {"name": "Free", "slug": "free", "price": "0.01"}
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_staff_can_add_a_pizza(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            "/api/pizzas/get/",
            {
                "name": "Quattro Formaggi",
                "slug": "quattro-formaggi",
                "price": "15.00",
                "toppings": "four cheeses",
                "description": "All of the cheese.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(Pizza.objects.filter(slug="quattro-formaggi").exists())
