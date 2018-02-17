from django.urls import path, include

from rest_framework import routers
from delivery import views


router = routers.DefaultRouter()
router.register('orders', views.OrdersViewSet)
router.register('pizzas', views.PizzaViewSet)

urlpatterns = [
]

urlpatterns += router.urls
