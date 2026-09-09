from django.contrib.auth.models import User
from rest_framework import serializers

from delivery.models import Order, Pizza


class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ("username", "id", "url")


class PizzaSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Pizza
        fields = ("id", "slug", "name", "price", "toppings", "description", "url")


class GetOrderSerializer(serializers.HyperlinkedModelSerializer):
    """Read shape: items and user rendered as names rather than links."""

    items = serializers.StringRelatedField(many=True, read_only=True)
    user = serializers.SlugRelatedField(read_only=True, slug_field="username")

    class Meta:
        model = Order
        fields = ("id", "user", "items", "total", "status", "created_at", "url")


class NewOrderSerializer(serializers.HyperlinkedModelSerializer):
    """Write shape.

    `user` is taken from the authenticated request rather than the payload, so
    an order can only ever be created for the caller.
    """

    user = serializers.SlugRelatedField(read_only=True, slug_field="username")
    url = serializers.HyperlinkedIdentityField(view_name="order-detail")

    class Meta:
        model = Order
        fields = ("id", "user", "total", "status", "created_at", "url")
