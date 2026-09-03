from django.contrib.auth.models import User
from django.db import models


class Pizza(models.Model):
    name = models.CharField(max_length=30)
    price = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return self.name


class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    pizzas = models.ManyToManyField(Pizza)
    total = models.DecimalField(max_digits=7, decimal_places=2)
    status = models.CharField(max_length=30)

    def __str__(self):
        return "Order #%s (%s)" % (self.pk, self.status)
