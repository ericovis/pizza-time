from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


class Pizza(models.Model):
    """A menu pizza.

    `slug` is the stable key: the frontend's procedural pizza art keys its
    topping recipes on it, so it must not change once orders reference it.
    """

    name = models.CharField(max_length=30)
    slug = models.SlugField(unique=True)
    price = models.DecimalField(max_digits=5, decimal_places=2)
    toppings = models.CharField(max_length=120, blank=True)
    description = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return self.name


class Order(models.Model):
    class Status(models.TextChoices):
        # The stored value equals the label on purpose: rows written before
        # this became a TextChoices field already hold "Ordered"/"Delivered".
        ORDERED = "Ordered", "Ordered"
        IN_OVEN = "In the oven", "In the oven"
        OUT_FOR_DELIVERY = "Out for delivery", "Out for delivery"
        DELIVERED = "Delivered", "Delivered"

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    total = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.ORDERED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self):
        return "Order #%s (%s)" % (self.pk, self.status)

    def recompute_total(self, save=True):
        """Server-side total: the items plus the delivery fee.

        An order with no items costs nothing; the fee is only charged once
        there is something to deliver.
        """
        subtotal = sum(
            (item.line_total for item in self.items.all()), Decimal("0.00")
        )
        self.total = subtotal + settings.DELIVERY_FEE if subtotal else Decimal("0.00")
        if save:
            self.save(update_fields=["total"])
        return self.total


class OrderItem(models.Model):
    """One pie on an order.

    `slices` holds exactly eight pizza ids, clockwise from twelve o'clock. A
    menu pizza is eight identical slices; a custom pie mixes flavors. `name`
    and `unit_price` are snapshots taken at order time, so editing the menu
    later does not rewrite history.
    """

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    slices = models.JSONField(default=list)
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=5, decimal_places=2)
    name = models.CharField(max_length=60)

    class Meta:
        ordering = ("id",)

    def __str__(self):
        return "%s x%s" % (self.name, self.quantity)

    @property
    def flavors(self):
        """The distinct pizzas of this pie, in slice order."""
        seen = []
        for pizza_id in self.slices:
            if pizza_id not in seen:
                seen.append(pizza_id)
        pizzas = Pizza.objects.in_bulk(seen)
        return [pizzas[pizza_id] for pizza_id in seen if pizza_id in pizzas]

    @property
    def is_custom(self):
        return len(set(self.slices)) > 1

    @property
    def line_total(self):
        return self.unit_price * self.quantity
