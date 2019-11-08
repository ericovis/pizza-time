import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


from rest_framework_jwt.views import obtain_jwt_token


urlpatterns = [
    path('api/v1/auth/', obtain_jwt_token),
    path('api/v1/', include('delivery.urls')),
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls',
                              namespace='rest_framework')),
    path('', include('django_prometheus.urls'))
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
