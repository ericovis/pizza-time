from rest_framework import viewsets, mixins

from delivery.serializers import *
from delivery.models import *
from delivery.permissions import *


class OrdersViewSet(viewsets.GenericViewSet,
                    mixins.CreateModelMixin,
                    mixins.DestroyModelMixin,
                    mixins.ListModelMixin):
    queryset = Order.objects.all()
    permission_classes = (OrderPermissions,)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AddOrderSerializer
        return GetOrderSerializer


class PizzaViewSet(viewsets.GenericViewSet,
                   mixins.ListModelMixin,
                   mixins.RetrieveModelMixin):
    serializer_class = PizzaSerializer
    queryset = Pizza.objects.all()
