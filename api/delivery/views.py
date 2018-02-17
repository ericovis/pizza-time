from rest_framework import viewsets, mixins

from delivery.serializers import *
from delivery.models import *
from delivery.permissions import *


class OrdersViewSet(viewsets.GenericViewSet,
                    mixins.CreateModelMixin,
                    mixins.DestroyModelMixin,
                    mixins.ListModelMixin,
                    mixins.RetrieveModelMixin):
    permission_classes = (OrderPermissions,)
    queryset = Order.objects.all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AddOrderSerializer
        return GetOrderSerializer

    def get_queryset(self):
        if self.request.user.is_staff:
            return Order.objects.all()
        return Order.objects.all().filter(user=self.request.user)


class PizzaViewSet(viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin):
    serializer_class = PizzaSerializer
    queryset = Pizza.objects.all()
