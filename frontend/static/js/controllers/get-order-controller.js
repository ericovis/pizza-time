var app = angular.module('pizza');

app.controller('GetOrderCtrl', function ($scope, $routeParams, $http, $rootScope) {
  $scope.isNewOrder = $routeParams.new === 'new';

  $http.get($rootScope.APIURL + '/api/orders/get/' + $routeParams.id + '/')
    .then(function (response) {
      $scope.order = response.data;
    }, function (response) {
      console.log(response.data);
    });
});
