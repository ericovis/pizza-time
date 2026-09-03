from django.urls import include, path
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = routers.DefaultRouter()
router.register(r"users", views.UserViewSet)
router.register(r"pizzas/get", views.PizzaViewSet)
router.register(r"orders/get", views.GetOrderViewSet, basename="order")
router.register(r"orders/new", views.NewOrderViewSet, basename="order-new")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
