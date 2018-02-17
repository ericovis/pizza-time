from rest_framework import serializers

from delivery.models import *


class PizzaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pizza
        fields = '__all__'


class AddOrderSerializer(serializers.ModelSerializer):
    pizzas = serializers.PrimaryKeyRelatedField(many=True,
                                                queryset=Pizza.objects.all(),
                                                allow_empty=False)

    class Meta:
        model = Order
        fields = ('pizzas', 'user', 'total', 'id', 'status')
        read_only_fields = ('status', 'total', 'user')

    def create(self, validated_data):
        pizzas = validated_data.pop('pizzas')
        order = Order(user=self.context['request'].user)
        for pizza in pizzas:
            order.total += pizza.price
            order.pizzas.add(pizza)
        order.save()
        return order


class GetOrderSerializer(serializers.ModelSerializer):
    pizzas = PizzaSerializer(many=True)

    class Meta:
        model = Order
        fields = ('pizzas', 'user', 'total', 'id', 'status')
        read_only_fields = ('status', 'total', 'user')
