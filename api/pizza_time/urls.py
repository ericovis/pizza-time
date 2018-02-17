import os

from django.contrib import admin
from django.urls import path, include

from rest_framework_jwt.views import obtain_jwt_token


urlpatterns = [
    path('api/v1/auth/', obtain_jwt_token),
    path('api/v1/delivery/', include('delivery.urls')),
]

if os.environ.get('DJANGO_ENV', '') == 'dev':
    dev_urls = [
        path('admin/', admin.site.urls),
        path('api-auth/', include('rest_framework.urls',
                                  namespace='rest_framework')),
    ]
    urlpatterns += dev_urls
