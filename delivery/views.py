from rest_framework import mixins, viewsets
from rest_framework.response import Response

from delivery.models import Order, Pizza
from delivery.permissions import IsStaffOrReadOnly
from delivery.serializers import (
    GetOrderSerializer,
    NewOrderSerializer,
    PizzaSerializer,
)


class PizzaViewSet(viewsets.ModelViewSet):
    """The pizza catalog.

    Readable by anyone, including signed-out visitors: the menu and the
    builder are public pages. Only staff can change it, and they normally do
    that in the admin.
    """

    serializer_class = PizzaSerializer
    permission_classes = (IsStaffOrReadOnly,)
    queryset = Pizza.objects.all()

    def get_queryset(self):
        # Retired pizzas stay readable to staff (and stay referenced by old
        # orders), but they leave the menu.
        queryset = Pizza.objects.all()
        user = self.request.user
        if not (user and user.is_authenticated and user.is_staff):
            queryset = queryset.filter(is_active=True)
        return queryset


class GetOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Orders in display form. Registered at /api/orders/get/."""

    serializer_class = GetOrderSerializer
    queryset = Order.objects.all()

    def get_queryset(self):
        queryset = Order.objects.select_related("user").prefetch_related("items")
        user = self.request.user
        if not (user and user.is_authenticated):
            return queryset.none()
        if user.is_staff:
            # Only reachable through the browsable API with a session, since
            # staff cannot obtain a token.
            return queryset
        # Filtering the queryset rather than checking ownership per object
        # means someone else's order is a 404, not a 403, so ids stay
        # unenumerable.
        return queryset.filter(user=user)


class NewOrderViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Order creation, and nothing else. Registered at /api/orders/new/.

    There is deliberately no list, retrieve, update or delete here: reading
    goes through GetOrderViewSet, which enforces ownership.
    """

    serializer_class = NewOrderSerializer
    queryset = Order.objects.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Answer in the read shape so the frontend can go straight to the
        # tracking screen without a second request.
        read = GetOrderSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read.data)
        return Response(read.data, status=201, headers=headers)
