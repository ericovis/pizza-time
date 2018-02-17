var app = angular.module('pizza');

app.controller('NewOrderCtrl', function ($scope, $http, $window, $rootScope) {
  $scope.review = false;
  $scope.cart = [];
  $scope.review = false;

  $http({url: $rootScope.APIURL + '/pizzas/', method: 'GET'})
  .success(function (data, status, headers, config) {
    $scope.pizzasList = data;
  })
  .error(function (data, status, headers, config) {
    console.log(data);
  });

  $scope.order = {
    pizzas: []
  };


  $scope.checkout = function (){
      $scope.order = {
        pizzas: [],
        total: 0.00
      };
      $scope.selectedPizzas = [];

      for (var i = 0 ; i < $scope.cart.length ; i++){
        var obj = JSON.parse($scope.cart[i]);
        $scope.order.total += Number(obj.price);
        $scope.order.pizzas.push(obj.id);
        $scope.selectedPizzas.push({name: obj.name, price: obj.price });
      };
      if ($scope.order.pizzas.length > 0){
        $scope.order.total = $scope.order.total.toFixed(2);
        $scope.order.total = $scope.order.total.toString();

        $scope.review = true;
    };
  };

  $scope.submitOrder = function () {
    $http.post($rootScope.APIURL + '/orders/', $scope.order)
    .success(function (data, status, headers, config) {
      console.log(data);
      $window.location.href = '#/orders/' + data.id + '/new/';
    })
    .error(function (data, status, headers, config) {
      console.log($scope.order);
      console.log(data);
    });
  };




});
