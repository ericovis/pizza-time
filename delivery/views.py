from django.contrib.auth.models import User
from rest_framework import viewsets

from delivery.models import Order, Pizza
from delivery.serializers import (
    GetOrderSerializer,
    NewOrderSerializer,
    PizzaSerializer,
    UserSerializer,
)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only user list, used to resolve hyperlinked user references."""

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer


class PizzaViewSet(viewsets.ModelViewSet):
    """The pizza catalog."""

    queryset = Pizza.objects.all().order_by("name")
    serializer_class = PizzaSerializer


class GetOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Orders in display form. Registered at /api/orders/get/."""

    queryset = Order.objects.all().order_by("-id")
    serializer_class = GetOrderSerializer


class NewOrderViewSet(viewsets.ModelViewSet):
    """Order creation. Registered at /api/orders/new/."""

    queryset = Order.objects.all().order_by("-id")
    serializer_class = NewOrderSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
