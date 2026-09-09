from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from delivery.models import Order, OrderItem, Pizza
from delivery.pricing import item_name, unit_price

SLICES_PER_PIZZA = 8
MAX_QUANTITY = 9
# A cart is a demo cart. The cap is here so an unbounded `items` list cannot
# push the order total past what Order.total can hold, which the database
# answers with a DataError -- a 500 for what is really a bad request.
MAX_ITEMS = 20

_TOTAL_FIELD = Order._meta.get_field("total")
MAX_ORDER_TOTAL = Decimal(10) ** (
    _TOTAL_FIELD.max_digits - _TOTAL_FIELD.decimal_places
) - Decimal("0.01")


class PizzaSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Pizza
        fields = ("id", "slug", "name", "price", "toppings", "description", "url")


class OrderItemReadSerializer(serializers.ModelSerializer):
    """One pie as the order screens want it: names, not ids.

    `slices` stays a list of pizza ids so the frontend can hand it straight to
    the pizza art element after resolving them to slugs.
    """

    flavors = serializers.SerializerMethodField()
    line_total = serializers.DecimalField(max_digits=7, decimal_places=2, read_only=True)
    is_custom = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrderItem
        fields = (
            "name",
            "slices",
            "flavors",
            "quantity",
            "unit_price",
            "line_total",
            "is_custom",
        )

    def get_flavors(self, item):
        names = self._pizza_names()
        # dict.fromkeys keeps the first appearance of each flavor, so the
        # names come back in slice order. Ids of pizzas that have since been
        # deleted are skipped; the snapshot `name` still describes the pie.
        return [
            names[pizza_id]
            for pizza_id in dict.fromkeys(item.slices)
            if pizza_id in names
        ]

    def _pizza_names(self):
        """The whole catalog, id to name, fetched once per response.

        `OrderItem.flavors` costs a query per pie, which an order list turns
        into a dozen. The catalog is eleven rows: read it once and cache it on
        the serializer context, which the view rebuilds for every request.
        """
        names = self.context.get("pizza_names")
        if names is None:
            names = dict(Pizza.objects.values_list("pk", "name"))
            self.context["pizza_names"] = names
        return names


class GetOrderSerializer(serializers.HyperlinkedModelSerializer):
    """Read shape. `url` points at this endpoint (basename `order`)."""

    user = serializers.SlugRelatedField(read_only=True, slug_field="username")
    items = OrderItemReadSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    delivery_fee = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "user",
            "status",
            "status_label",
            "created_at",
            "items",
            "delivery_fee",
            "total",
            "url",
        )

    def get_delivery_fee(self, order):
        # The server value is authoritative; the frontend's constant is only
        # for the cart preview, before an order exists.
        return str(Decimal(settings.DELIVERY_FEE).quantize(Decimal("0.01")))


class OrderItemWriteSerializer(serializers.ModelSerializer):
    """What a client may say about a pie: which eight slices, and how many.

    `name` and `unit_price` are derived here, never accepted from the payload.
    """

    slices = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=SLICES_PER_PIZZA,
        max_length=SLICES_PER_PIZZA,
        help_text="Exactly eight pizza ids, clockwise from twelve o'clock.",
    )
    quantity = serializers.IntegerField(min_value=1, max_value=MAX_QUANTITY, default=1)

    class Meta:
        model = OrderItem
        fields = ("slices", "quantity")

    def validate(self, attrs):
        wanted = list(dict.fromkeys(attrs["slices"]))
        available = {
            pizza.pk: pizza
            for pizza in Pizza.objects.filter(pk__in=wanted, is_active=True)
        }
        missing = [pizza_id for pizza_id in wanted if pizza_id not in available]
        if missing:
            raise serializers.ValidationError(
                {
                    "slices": "No pizza on the menu with id %s."
                    % ", ".join(str(pizza_id) for pizza_id in missing)
                }
            )
        # Distinct flavors, in slice order.
        flavors = [available[pizza_id] for pizza_id in wanted]
        attrs["unit_price"] = unit_price(flavors)
        attrs["name"] = item_name(flavors)
        return attrs


class NewOrderSerializer(serializers.ModelSerializer):
    """Write shape: a list of pies, nothing else.

    The user comes from the request, the status is always `Ordered`, and the
    total is computed from the items, so none of them can be dictated by a
    client. `url` points at the read endpoint (`order-detail`) because this
    viewset has no detail route of its own.
    """

    items = OrderItemWriteSerializer(
        many=True,
        allow_empty=False,
        max_length=MAX_ITEMS,
        error_messages={
            "max_length": "An order can hold at most %s pizzas." % MAX_ITEMS
        },
    )
    user = serializers.SlugRelatedField(read_only=True, slug_field="username")
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    url = serializers.HyperlinkedIdentityField(view_name="order-detail")

    class Meta:
        model = Order
        fields = (
            "id",
            "user",
            "items",
            "status",
            "status_label",
            "created_at",
            "total",
            "url",
        )
        read_only_fields = ("id", "status", "created_at", "total")

    def validate(self, attrs):
        # The item cap keeps menu-priced orders well inside Order.total, but a
        # pizza priced near the Pizza.price ceiling could still overflow it.
        # Refuse in the serializer so the answer is a 400, never a DataError.
        subtotal = sum(
            (item["unit_price"] * item["quantity"] for item in attrs["items"]),
            Decimal("0.00"),
        )
        if subtotal + settings.DELIVERY_FEE > MAX_ORDER_TOTAL:
            raise serializers.ValidationError(
                {"items": "That order is too expensive to place."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop("items")
        # Anything else the payload carried (total, status, user) has already
        # been dropped as read-only.
        order = Order.objects.create(
            user=validated_data["user"], status=Order.Status.ORDERED
        )
        OrderItem.objects.bulk_create(
            OrderItem(order=order, **item) for item in items
        )
        order.recompute_total()
        return order
