from django.contrib.auth.models import User
from django.db import models


class Pizza(models.Model):
    name = models.CharField(max_length=30)
    price = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return self.name


class Order(models.Model):
    status_choices = (
        ('R', 'Order received'),
        ('P', 'Order being prepared'),
        ('O', 'On its way'),
        ('D', 'Delivered')
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    pizzas = models.ManyToManyField(Pizza, blank=False)
    status = models.CharField(max_length=1,
                              choices=status_choices,
                              default='R')

    @property
    def total(self):
        t = 0
        for p in self.pizzas.all():
            t += p.price
        return t

    def __str__(self):
        return "Order {} - Total: USD {}".format(self.id, self.total)
