var app = angular.module('pizza');

app.controller('OrdersCtrl', function ($scope, $http, $rootScope) {
  $http.get($rootScope.APIURL + '/api/orders/get/')
    .then(function (response) {
      $scope.orders = response.data;
    }, function (response) {
      console.log(response.data);
    });
});
