from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.models import Order, OrderItem, Pizza


class OrderTestCase(APITestCase):
    """Shared catalog and cast for the order tests."""

    def setUp(self):
        self.user = User.objects.create_user("jklimber", password="start123")
        self.other = User.objects.create_user("kimberly", password="start123")
        self.staff = User.objects.create_user(
            "admin", password="admin123", is_staff=True
        )
        self.margherita = Pizza.objects.create(
            name="Margherita", slug="margherita", price=Decimal("12.50")
        )
        self.pepperoni = Pizza.objects.create(
            name="Pepperoni", slug="pepperoni", price=Decimal("14.00")
        )
        self.retired = Pizza.objects.create(
            name="Hawaiian", slug="hawaiian", price=Decimal("10.00"), is_active=False
        )
        self.client.force_authenticate(user=self.user)

    def whole(self, pizza):
        return [pizza.pk] * 8

    def place(self, *items):
        return self.client.post("/api/orders/new/", {"items": list(items)}, format="json")

    def make_order(self, *pizzas, **kwargs):
        """Build an order directly, bypassing the API."""
        order = Order.objects.create(user=kwargs.pop("user", self.user))
        for pizza in pizzas:
            OrderItem.objects.create(
                order=order,
                slices=self.whole(pizza),
                quantity=kwargs.get("quantity", 1),
                unit_price=pizza.price,
                name=pizza.name,
            )
        order.recompute_total()
        return order


class OrderCreateTests(OrderTestCase):
    def test_menu_pizza_order_is_price_plus_fee(self):
        response = self.place({"slices": self.whole(self.margherita)})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.total, Decimal("17.50"))
        self.assertEqual(order.items.get().name, "Margherita")

    def test_custom_pizza_costs_its_priciest_flavor(self):
        slices = [self.margherita.pk] * 4 + [self.pepperoni.pk] * 4
        response = self.place({"slices": slices})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        item = Order.objects.get(pk=response.data["id"]).items.get()
        self.assertEqual(item.unit_price, Decimal("14.00"))
        self.assertEqual(item.name, "Your 2-flavor pizza")
        self.assertTrue(item.is_custom)

    def test_quantity_multiplies_the_line(self):
        response = self.place({"slices": self.whole(self.margherita), "quantity": 2})

        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.total, Decimal("30.00"))

    def test_several_items_add_up_with_one_fee(self):
        response = self.place(
            {"slices": self.whole(self.margherita)},
            {"slices": self.whole(self.pepperoni), "quantity": 2},
        )

        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.items.count(), 2)
        self.assertEqual(order.total, Decimal("45.50"))

    def test_client_cannot_dictate_total_status_or_user(self):
        response = self.place({"slices": self.whole(self.margherita)})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/orders/new/",
            {
                "items": [{"slices": self.whole(self.margherita)}],
                "total": "0.01",
                "status": Order.Status.DELIVERED,
                "user": self.other.username,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get(pk=response.data["id"])
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.status, Order.Status.ORDERED)
        self.assertEqual(order.total, Decimal("17.50"))

    def test_a_pie_needs_exactly_eight_slices(self):
        for slices in ([self.margherita.pk] * 7, [self.margherita.pk] * 9, []):
            with self.subTest(count=len(slices)):
                response = self.place({"slices": slices})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_unknown_pizza_id_is_rejected(self):
        response = self.place({"slices": [self.margherita.pk] * 7 + [9999]})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_inactive_pizza_is_rejected(self):
        response = self.place({"slices": self.whole(self.retired)})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_quantity_is_capped(self):
        for quantity in (0, 10):
            with self.subTest(quantity=quantity):
                response = self.place(
                    {"slices": self.whole(self.margherita), "quantity": quantity}
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_order_needs_at_least_one_item(self):
        for payload in ({"items": []}, {}):
            with self.subTest(payload=payload):
                response = self.client.post("/api/orders/new/", payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_response_is_the_read_shape(self):
        response = self.place({"slices": self.whole(self.margherita), "quantity": 2})

        self.assertEqual(
            set(response.data),
            {
                "id",
                "user",
                "status",
                "status_label",
                "created_at",
                "items",
                "delivery_fee",
                "total",
                "url",
            },
        )
        self.assertEqual(response.data["user"], "jklimber")
        self.assertEqual(response.data["status"], Order.Status.ORDERED)
        self.assertEqual(response.data["delivery_fee"], "5.00")
        self.assertEqual(response.data["total"], "30.00")
        item = response.data["items"][0]
        self.assertEqual(item["name"], "Margherita")
        self.assertEqual(item["flavors"], ["Margherita"])
        self.assertEqual(item["quantity"], 2)
        self.assertEqual(item["line_total"], "25.00")
        self.assertFalse(item["is_custom"])
        # The created order links back to the read endpoint, not to itself.
        self.assertTrue(
            response.data["url"].endswith("/api/orders/get/%s/" % response.data["id"])
        )

    def test_anonymous_cannot_place_an_order(self):
        self.client.force_authenticate(user=None)
        response = self.place({"slices": self.whole(self.margherita)})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OrderOwnershipTests(OrderTestCase):
    def setUp(self):
        super().setUp()
        self.mine = self.make_order(self.margherita)
        self.theirs = self.make_order(self.pepperoni, user=self.other)

    def test_list_contains_only_my_orders(self):
        response = self.client.get("/api/orders/get/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([o["id"] for o in response.data], [self.mine.pk])

    def test_someone_elses_order_is_not_found(self):
        response = self.client.get("/api/orders/get/%s/" % self.theirs.pk)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_see_every_order(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/orders/get/")
        self.assertEqual(
            sorted(o["id"] for o in response.data),
            sorted([self.mine.pk, self.theirs.pk]),
        )

    def test_orders_get_is_read_only(self):
        detail = "/api/orders/get/%s/" % self.mine.pk
        for method, url in (
            (self.client.post, "/api/orders/get/"),
            (self.client.put, detail),
            (self.client.patch, detail),
            (self.client.delete, detail),
        ):
            with self.subTest(method=method.__name__):
                response = method(url, {}, format="json")
                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )

    def test_orders_new_only_accepts_post(self):
        for method in (self.client.get, self.client.put, self.client.patch,
                       self.client.delete):
            with self.subTest(method=method.__name__):
                response = method("/api/orders/new/")
                self.assertEqual(
                    response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED
                )

    def test_orders_new_has_no_detail_route(self):
        # Not even for my own order: reading and editing go nowhere near the
        # create endpoint, so the router generates no detail URL at all.
        for method in (self.client.get, self.client.put, self.client.delete):
            with self.subTest(method=method.__name__):
                response = method("/api/orders/new/%s/" % self.mine.pk)
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class OrderReadTests(OrderTestCase):
    def setUp(self):
        super().setUp()
        self.order = Order.objects.create(
            user=self.user, status=Order.Status.OUT_FOR_DELIVERY
        )
        OrderItem.objects.create(
            order=self.order,
            slices=self.whole(self.margherita),
            quantity=2,
            unit_price=self.margherita.price,
            name="Margherita",
        )
        OrderItem.objects.create(
            order=self.order,
            slices=[self.pepperoni.pk] * 4 + [self.margherita.pk] * 4,
            unit_price=self.pepperoni.price,
            name="Your 2-flavor pizza",
        )
        self.order.recompute_total()

    def test_detail_renders_items_with_names_and_flavors(self):
        response = self.client.get("/api/orders/get/%s/" % self.order.pk)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        menu, custom = response.data["items"]
        self.assertEqual(menu["name"], "Margherita")
        self.assertEqual(menu["flavors"], ["Margherita"])
        self.assertEqual(menu["slices"], [self.margherita.pk] * 8)
        self.assertEqual(menu["unit_price"], "12.50")
        self.assertEqual(menu["line_total"], "25.00")
        self.assertFalse(menu["is_custom"])
        self.assertEqual(custom["flavors"], ["Pepperoni", "Margherita"])
        self.assertTrue(custom["is_custom"])

    def test_detail_carries_status_label_fee_and_timestamp(self):
        response = self.client.get("/api/orders/get/%s/" % self.order.pk)

        self.assertEqual(response.data["status"], "Out for delivery")
        self.assertEqual(response.data["status_label"], "Out for delivery")
        self.assertEqual(response.data["delivery_fee"], "5.00")
        self.assertEqual(response.data["total"], "44.00")
        self.assertIsNotNone(response.data["created_at"])

    def test_list_is_newest_first(self):
        older = self.make_order(self.pepperoni)
        Order.objects.filter(pk=older.pk).update(
            created_at=self.order.created_at.replace(year=2020)
        )

        response = self.client.get("/api/orders/get/")
        self.assertEqual([o["id"] for o in response.data], [self.order.pk, older.pk])
