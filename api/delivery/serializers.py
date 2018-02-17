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
        fields = ('pizzas', 'id')
        read_only_fields = ('id',)

    def create(self, validated_data):
        pizzas = validated_data.pop('pizzas')
        order = Order(user=self.context['request'].user)
        order.save()
        for pizza in pizzas:
            order.pizzas.add(pizza)
        order.save()
        return order


class GetOrderSerializer(serializers.ModelSerializer):
    pizzas = PizzaSerializer(many=True)
    status = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ('pizzas', 'total', 'id', 'status', 'user')

    def get_status(self, obj):
        return obj.get_status_display()

    def get_user(self, obj):
        return obj.user.username
