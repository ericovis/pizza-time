from decimal import Decimal
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.models import Order, OrderItem, Pizza


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
        self.margherita = Pizza.objects.create(
            name="Margherita", slug="margherita", price=Decimal("12.50")
        )
        self.pepperoni = Pizza.objects.create(
            name="Pepperoni", slug="pepperoni", price=Decimal("14.00")
        )
        self.client.force_authenticate(user=self.user)

    def _order_with(self, *pizzas, **kwargs):
        order = Order.objects.create(user=kwargs.pop("user", self.user))
        for pizza in pizzas:
            OrderItem.objects.create(
                order=order,
                slices=[pizza.pk] * 8,
                quantity=kwargs.get("quantity", 1),
                unit_price=pizza.price,
                name=pizza.name,
            )
        order.recompute_total()
        return order

    def test_create_order(self):
        response = self.client.post("/api/orders/new/", {"status": "Ordered"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.status, Order.Status.ORDERED)

    def test_order_user_comes_from_request_not_payload(self):
        response = self.client.post(
            "/api/orders/new/", {"user": self.other.username, "status": "Ordered"}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Order.objects.get(pk=response.data["id"]).user, self.user)

    def test_read_order_renders_names(self):
        order = self._order_with(self.margherita)

        response = self.client.get("/api/orders/get/%s/" % order.pk)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"], "jklimber")
        self.assertEqual(response.data["items"], ["Margherita x1"])

    def test_orders_get_is_read_only(self):
        response = self.client.post("/api/orders/get/", {})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_total_is_items_plus_delivery_fee(self):
        order = self._order_with(self.margherita, self.pepperoni)
        self.assertEqual(order.total, Decimal("31.50"))

    def test_empty_order_costs_nothing(self):
        order = Order.objects.create(user=self.user)
        self.assertEqual(order.recompute_total(), Decimal("0.00"))

    def test_item_flavors_and_is_custom(self):
        order = Order.objects.create(user=self.user)
        menu_item = OrderItem.objects.create(
            order=order,
            slices=[self.margherita.pk] * 8,
            unit_price=self.margherita.price,
            name="Margherita",
        )
        custom_item = OrderItem.objects.create(
            order=order,
            slices=[self.pepperoni.pk] * 4 + [self.margherita.pk] * 4,
            unit_price=self.pepperoni.price,
            name="Your 2-flavor pizza",
        )
        self.assertFalse(menu_item.is_custom)
        self.assertEqual(menu_item.flavors, [self.margherita])
        self.assertTrue(custom_item.is_custom)
        self.assertEqual(custom_item.flavors, [self.pepperoni, self.margherita])


class SeedCommandTests(APITestCase):
    """seed_demo runs on every boot, so it has to be safe to run twice."""

    def setUp(self):
        call_command("seed_demo", stdout=StringIO())

    def test_catalog_is_seeded(self):
        self.assertEqual(Pizza.objects.count(), 11)
        self.assertEqual(
            Pizza.objects.get(slug="pepperoni").price, Decimal("12.23")
        )

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

    def test_other_customers_have_their_own_orders(self):
        for username in ("kimberly", "carlos"):
            with self.subTest(username=username):
                self.assertEqual(
                    Order.objects.filter(user__username=username).count(), 1
                )

    def test_staff_user_is_created(self):
        admin = User.objects.get(username="admin")
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

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
