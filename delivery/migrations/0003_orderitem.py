"""Custom pizzas, order status choices and timestamps.

Adds the new Pizza and Order columns, introduces OrderItem, copies every
existing Order.pizzas row into an OrderItem of eight identical slices, and
only then drops the many-to-many. Old databases (the ones seeded from the
now-deleted initial_data fixture) migrate forward without losing an order.
"""

from decimal import Decimal

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models
from django.utils.text import slugify


def forwards(apps, schema_editor):
    Pizza = apps.get_model("delivery", "Pizza")
    Order = apps.get_model("delivery", "Order")
    OrderItem = apps.get_model("delivery", "OrderItem")

    taken = set()
    for pizza in Pizza.objects.all().order_by("id"):
        base = slugify(pizza.name) or "pizza-%s" % pizza.pk
        slug, suffix = base, 2
        while slug in taken:
            slug = "%s-%s" % (base, suffix)
            suffix += 1
        taken.add(slug)
        pizza.slug = slug
        pizza.save(update_fields=["slug"])

    for order in Order.objects.all().order_by("id"):
        for pizza in order.pizzas.all().order_by("id"):
            OrderItem.objects.create(
                order=order,
                slices=[pizza.pk] * 8,
                quantity=1,
                unit_price=pizza.price,
                name=pizza.name,
            )


class Migration(migrations.Migration):

    dependencies = [
        ("delivery", "0002_alter_order_id_alter_pizza_id"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="order",
            options={"ordering": ("-created_at", "-id")},
        ),
        migrations.AlterModelOptions(
            name="pizza",
            options={"ordering": ("id",)},
        ),
        migrations.AddField(
            model_name="pizza",
            # A plain CharField first: it is filled in by the data migration
            # below and only then turned into the real, unique SlugField. Going
            # straight to SlugField would index the column twice on Postgres.
            name="slug",
            field=models.CharField(default="", max_length=50),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="pizza",
            name="toppings",
            field=models.CharField(blank=True, default="", max_length=120),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="pizza",
            name="description",
            field=models.CharField(blank=True, default="", max_length=160),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="pizza",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="order",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("Ordered", "Ordered"),
                    ("In the oven", "In the oven"),
                    ("Out for delivery", "Out for delivery"),
                    ("Delivered", "Delivered"),
                ],
                default="Ordered",
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="total",
            field=models.DecimalField(
                decimal_places=2, default=Decimal("0.00"), max_digits=7
            ),
        ),
        migrations.CreateModel(
            name="OrderItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("slices", models.JSONField(default=list)),
                ("quantity", models.PositiveSmallIntegerField(default=1)),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=5)),
                ("name", models.CharField(max_length=60)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="delivery.order",
                    ),
                ),
            ],
            options={"ordering": ("id",)},
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pizza",
            name="slug",
            field=models.SlugField(unique=True),
        ),
        migrations.RemoveField(
            model_name="order",
            name="pizzas",
        ),
    ]
