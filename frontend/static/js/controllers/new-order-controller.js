var app = angular.module('pizza');

app.constant('DELIVERY_FEE', 5.00);

app.controller('NewOrderCtrl', function ($scope, $http, $window, $rootScope, DELIVERY_FEE) {
  $scope.review = false;
  $scope.cart = [];
  $scope.deliveryFee = DELIVERY_FEE;

  $http.get($rootScope.APIURL + '/api/pizzas/get/')
    .then(function (response) {
      $scope.pizzasList = response.data;
    }, function (response) {
      console.log(response.data);
    });

  $scope.checkout = function () {
    var total = DELIVERY_FEE;
    var order = {pizzas: [], total: 0, status: 'Ordered'};
    $scope.selectedPizzas = [];

    for (var i = 0; i < $scope.cart.length; i++) {
      var pizza = JSON.parse($scope.cart[i]);
      total += Number(pizza.price);
      order.pizzas.push(pizza.url);
      $scope.selectedPizzas.push({name: pizza.name, price: pizza.price});
    }

    if (order.pizzas.length === 0) {
      return;
    }

    order.total = total.toFixed(2);
    $scope.order = order;
    $scope.review = true;
  };

  $scope.submitOrder = function () {
    $http.post($rootScope.APIURL + '/api/orders/new/', $scope.order)
      .then(function (response) {
        $window.location.href = '#/orders/' + response.data.id + '/new/';
      }, function (response) {
        console.log(response.data);
      });
  };
});
