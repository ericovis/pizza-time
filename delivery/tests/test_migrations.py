"""Migration 0003 copies the old Order.pizzas rows into OrderItems.

This is the one code path on the branch that only ever runs against a
pre-existing database, so it gets exercised here by winding the schema back
to 0002, writing rows the way the old fixture did, and migrating forward.
"""

from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

BEFORE = [("delivery", "0002_alter_order_id_alter_pizza_id")]
AFTER = [("delivery", "0003_orderitem")]


class OrderItemDataMigrationTests(TransactionTestCase):
    def setUp(self):
        executor = MigrationExecutor(connection)
        executor.migrate(BEFORE)
        apps = executor.loader.project_state(BEFORE).apps
        User = apps.get_model("auth", "User")
        Pizza = apps.get_model("delivery", "Pizza")
        Order = apps.get_model("delivery", "Order")

        user = User.objects.create(username="legacy")
        cheese = Pizza.objects.create(name="Cheese", price=Decimal("11.23"))
        broccoli = Pizza.objects.create(name="Broccoli", price=Decimal("11.00"))
        # Two pizzas with the same name: the slug has to stay unique.
        Pizza.objects.create(name="Broccoli", price=Decimal("12.00"))

        order = Order.objects.create(user=user, total=Decimal("22.23"), status="Delivered")
        order.pizzas.add(cheese, broccoli)
        Order.objects.create(user=user, total=Decimal("0.00"), status="Ordered")
        self.order_id = order.pk

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(AFTER)
        self.apps = executor.loader.project_state(AFTER).apps

    def tearDown(self):
        # Leave the schema at the latest migration for the tests that follow.
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_each_old_pizza_becomes_an_item_of_eight_identical_slices(self):
        OrderItem = self.apps.get_model("delivery", "OrderItem")
        items = list(OrderItem.objects.filter(order_id=self.order_id).order_by("id"))
        self.assertEqual(len(items), 2)
        self.assertEqual([it.name for it in items], ["Cheese", "Broccoli"])
        self.assertEqual([it.unit_price for it in items], [Decimal("11.23"), Decimal("11.00")])
        for item in items:
            self.assertEqual(len(item.slices), 8)
            self.assertEqual(len(set(item.slices)), 1)
            self.assertEqual(item.quantity, 1)

    def test_orders_without_pizzas_get_no_items_and_keep_their_status(self):
        Order = self.apps.get_model("delivery", "Order")
        empty = Order.objects.exclude(pk=self.order_id).get()
        self.assertEqual(empty.items.count(), 0)
        self.assertEqual(empty.status, "Ordered")
        self.assertIsNotNone(empty.created_at)

    def test_slugs_are_derived_from_names_and_kept_unique(self):
        Pizza = self.apps.get_model("delivery", "Pizza")
        slugs = sorted(Pizza.objects.values_list("slug", flat=True))
        self.assertEqual(slugs, ["broccoli", "broccoli-2", "cheese"])

    def test_the_many_to_many_table_is_gone(self):
        self.assertNotIn("delivery_order_pizzas", connection.introspection.table_names())
